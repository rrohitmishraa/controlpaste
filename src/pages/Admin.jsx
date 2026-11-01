import { useEffect, useState } from "react";
import { ref, listAll, getDownloadURL, deleteObject } from "firebase/storage";
import { storage, database } from "../firebase";
import { ref as dbRef, set, get, remove, onValue } from "firebase/database";
import JSZip from "jszip";
import { Trash2, Pin, Download, Maximize2 } from "lucide-react";
import { saveAs } from "file-saver";

const PAGE_SIZE = 12;

const formatDate = (ts) => {
  const d = new Date(ts);

  return d.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(() => {
    return sessionStorage.getItem("admin_logged_in") === "true";
  });

  const [credentials, setCredentials] = useState({
    id: "",
    password: "",
  });

  const [allIds, setAllIds] = useState([]);
  const [dbSettings, setDbSettings] = useState({});

  // IMPORTANT:
  // This contains ONLY the images for the current page.
  const [images, setImages] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [currentPage, setCurrentPage] = useState(() => {
    return Math.max(1, Number(localStorage.getItem("admin_page")) || 1);
  });

  const [showVisitors, setShowVisitors] = useState(false);
  const [showLiveUsers, setShowLiveUsers] = useState(false);
  const [visitors, setVisitors] = useState([]);
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [liveUsers, setLiveUsers] = useState({});
  const [liveUsersLoading, setLiveUsersLoading] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [ipDetails, setIpDetails] = useState({});

  /* ============================================================
     LOGIN
     ============================================================ */

  const handleLogin = (e) => {
    e.preventDefault();

    if (
      credentials.id === process.env.REACT_APP_ADMIN_ID &&
      credentials.password === process.env.REACT_APP_ADMIN_PASSWORD
    ) {
      setLoggedIn(true);
      sessionStorage.setItem("admin_logged_in", "true");
      setError("");
    } else {
      setError("Invalid credentials");
    }
  };

  /* ============================================================
     LOAD IMAGE IDS AND SETTINGS
     ============================================================ */

  useEffect(() => {
    if (!loggedIn) return;

    const loadIdsAndSettings = async () => {
      setLoading(true);

      try {
        const rootRes = await listAll(ref(storage));

        const imagesFolder = rootRes.prefixes.find(
          (folder) => folder.name === "images",
        );

        if (!imagesFolder) {
          setAllIds([]);
          setDbSettings({});
          setImages([]);
          return;
        }

        const imagesRes = await listAll(imagesFolder);

        const ids = imagesRes.items.map((item) => item.name);

        const settingsSnap = await get(dbRef(database, "gallerySettings"));

        const settings = settingsSnap.exists() ? settingsSnap.val() : {};

        setDbSettings(settings);

        // Only show visible images.
        const visibleIds = ids.filter((id) => settings[id]?.visible !== false);

        // Pinned images first.
        const pinnedIds = visibleIds.filter(
          (id) => settings[id]?.pinned === true,
        );

        const unpinnedIds = visibleIds.filter(
          (id) => settings[id]?.pinned !== true,
        );

        const sortedIds = [...pinnedIds, ...unpinnedIds];

        setAllIds(sortedIds);

        // Make sure the current page still exists.
        const totalPages = Math.max(1, Math.ceil(sortedIds.length / PAGE_SIZE));

        setCurrentPage((page) => Math.min(Math.max(1, page), totalPages));
      } catch (err) {
        console.error("Failed to load data:", err);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadIdsAndSettings();
  }, [loggedIn]);

  /* ============================================================
     LOAD CURRENT PAGE IMAGE URLS
     ============================================================ */

  useEffect(() => {
    let cancelled = false;

    const loadPageUrls = async () => {
      if (!allIds.length) {
        setImages([]);
        return;
      }

      const totalPages = Math.max(1, Math.ceil(allIds.length / PAGE_SIZE));

      const safePage = Math.min(Math.max(1, currentPage), totalPages);

      if (safePage !== currentPage) {
        setCurrentPage(safePage);
        return;
      }

      setLoading(true);

      try {
        const start = (safePage - 1) * PAGE_SIZE;

        // These are the ONLY images we load for this page.
        const pageIds = allIds.slice(start, start + PAGE_SIZE);

        const results = await Promise.all(
          pageIds.map(async (id) => {
            try {
              const url = await getDownloadURL(ref(storage, `images/${id}`));

              const settings = dbSettings[id] || {};

              return {
                id,
                url,
                visible: settings.visible !== false,
                pinned: settings.pinned === true,
                displayName: settings.displayName || id,
              };
            } catch (err) {
              console.error(`Failed to load ${id}:`, err);
              return null;
            }
          }),
        );

        if (!cancelled) {
          setImages(results.filter(Boolean));
        }
      } catch (err) {
        console.error("Failed to load page:", err);

        if (!cancelled) {
          setError("Failed to load images");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPageUrls();

    return () => {
      cancelled = true;
    };
  }, [allIds, currentPage, dbSettings]);

  /* ============================================================
     LOAD VISITORS
     ============================================================ */

  useEffect(() => {
    if (!showVisitors) return;

    const fetchVisitors = async () => {
      setVisitorsLoading(true);

      try {
        // Load IP-based visitor stats from /visitors (cloud function logVisit).
        const visitorsSnap = await get(dbRef(database, "visitors"));

        // Load image view logs from /viewLogs (ShowImage page tracking).
        const viewLogsSnap = await get(dbRef(database, "viewLogs"));

        const visitorsData = visitorsSnap.exists() ? visitorsSnap.val() : {};
        const viewLogsData = viewLogsSnap.exists() ? viewLogsSnap.val() : {};

        // Build IP -> visitor info from /visitors.
        const ipMap = {};

        Object.values(visitorsData).forEach((visitor) => {
          ipMap[visitor.ip] = {
            ip: visitor.ip,
            firstVisit: visitor.firstVisit,
            visitCount: visitor.visits ? Object.values(visitor.visits).length : 0,
            imagesViewed: [],
          };
        });

        // Merge view logs into IP map.
        Object.values(viewLogsData).forEach((logEntry) => {
          Object.values(logEntry).forEach((log) => {
            const ip = log.ip || log.sessionId || "unknown";
            if (!ipMap[ip]) {
              ipMap[ip] = {
                ip,
                firstVisit: log.viewedAt,
                visitCount: 0,
                imagesViewed: [],
              };
            }
            ipMap[ip].imagesViewed.push({
              imageId: log.imageId,
              viewedAt: log.viewedAt,
              sessionId: log.sessionId,
            });
          });
        });

        // Sort images viewed by newest first.
        Object.values(ipMap).forEach((v) => {
          v.imagesViewed.sort((a, b) => b.viewedAt - a.viewedAt);
        });

        const formatted = Object.values(ipMap);
        formatted.sort((a, b) => b.firstVisit - a.firstVisit);

        setVisitors(formatted);

        // Load IP details.
        formatted.forEach((visitor) => {
          if (!visitor.ip || ipDetails[visitor.ip]) return;

          fetch(`https://ipapi.co/${visitor.ip}/json/`)
            .then((res) => res.json())
            .then((data) => {
              setIpDetails((prev) => ({
                ...prev,
                [visitor.ip]: data,
              }));
            })
            .catch(() => {
              // Ignore IP lookup failures.
            });
        });
      } catch (err) {
        console.error("Failed to load visitors:", err);
      } finally {
        setVisitorsLoading(false);
      }
    };

    fetchVisitors();
  }, [showVisitors]);

  /* ============================================================
     LIVE USERS (who is viewing what right now)
     ============================================================ */

  useEffect(() => {
    if (!showLiveUsers) return;

    setLiveUsersLoading(true);

    const activeUsersRef = dbRef(database, "activeUsers");

    const unsubscribe = onValue(activeUsersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setLiveUsers(data);
      setLiveUsersLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [showLiveUsers]);

  /* ============================================================
     PERSIST PAGE
     ============================================================ */

  useEffect(() => {
    localStorage.setItem("admin_page", String(currentPage));
  }, [currentPage]);

  /* ============================================================
     IMAGE SETTINGS
     ============================================================ */

  const togglePin = async (id, current) => {
    const newVal = !current;

    try {
      await set(dbRef(database, `gallerySettings/${id}/pinned`), newVal);

      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, pinned: newVal } : img)),
      );

      setDbSettings((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          pinned: newVal,
        },
      }));

      // Update ordering so pinned images appear first.
      setAllIds((prev) => {
        const updated = prev.filter((item) => item !== id);

        if (newVal) {
          return [id, ...updated];
        }

        return [...updated, id];
      });
    } catch (err) {
      console.error("Failed to update pin:", err);
      alert("Failed to update image");
    }
  };

  const updateDisplayName = async (id, name) => {
    try {
      await set(dbRef(database, `gallerySettings/${id}/displayName`), name);

      setImages((prev) =>
        prev.map((img) =>
          img.id === id ? { ...img, displayName: name } : img,
        ),
      );

      setDbSettings((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          displayName: name,
        },
      }));
    } catch (err) {
      console.error("Failed to update display name:", err);
    }
  };

  /* ============================================================
     DOWNLOAD
     ============================================================ */

  const downloadImage = (url, filename) => {
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAllAsZip = async () => {
    setDownloadingAll(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder("images");

      const visibleIds = allIds.filter((id) => {
        const settings = dbSettings[id] || {};
        return settings.visible !== false;
      });

      for (const id of visibleIds) {
        const url = await getDownloadURL(ref(storage, `images/${id}`));

        const response = await fetch(url);
        const blob = await response.blob();

        const settings = dbSettings[id] || {};

        folder.file(settings.displayName || id, blob);
      }

      const content = await zip.generateAsync({
        type: "blob",
      });

      saveAs(content, "gallery-images.zip");
    } catch (err) {
      console.error(err);
      alert("Failed to create ZIP");
    } finally {
      setDownloadingAll(false);
    }
  };

  const downloadSelected = async () => {
    if (selectedIds.length === 0) return;

    setDownloadingAll(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder("images");

      // Download selected images, including images selected
      // from other pages.
      for (const id of selectedIds) {
        const url = await getDownloadURL(ref(storage, `images/${id}`));

        const response = await fetch(url);
        const blob = await response.blob();

        const settings = dbSettings[id] || {};

        folder.file(settings.displayName || id, blob);
      }

      const content = await zip.generateAsync({
        type: "blob",
      });

      saveAs(content, "selected-images.zip");
    } catch (err) {
      console.error(err);
      alert("Failed to create ZIP");
    } finally {
      setDownloadingAll(false);
    }
  };

  /* ============================================================
     DELETE
     ============================================================ */

  const deleteImage = async (id) => {
    if (!window.confirm(`Delete image ${id}?`)) return;

    setDeleting(true);

    try {
      await deleteObject(ref(storage, `images/${id}`));

      await remove(dbRef(database, `gallerySettings/${id}`));

      setAllIds((prev) => prev.filter((item) => item !== id));

      setImages((prev) => prev.filter((img) => img.id !== id));

      setSelectedIds((prev) => prev.filter((item) => item !== id));

      setDbSettings((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    } catch (err) {
      console.error(err);
      alert("Failed to delete image");
    } finally {
      setDeleting(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;

    if (!window.confirm(`Delete ${selectedIds.length} selected images?`)) {
      return;
    }

    setDeleting(true);

    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          try {
            await deleteObject(ref(storage, `images/${id}`));

            await remove(dbRef(database, `gallerySettings/${id}`));
          } catch (err) {
            console.error(`Failed to delete ${id}:`, err);
          }
        }),
      );

      setAllIds((prev) => prev.filter((id) => !selectedIds.includes(id)));

      setImages((prev) => prev.filter((img) => !selectedIds.includes(img.id)));

      setSelectedIds([]);
    } finally {
      setDeleting(false);
    }
  };

  /* ============================================================
     PAGINATION
     ============================================================ */

  const totalPages = Math.max(1, Math.ceil(allIds.length / PAGE_SIZE));

  /*
   * IMPORTANT:
   * `images` already contains ONLY the current page's images.
   * Do NOT slice it again.
   */
  const paginatedImages = images;

  const paginationItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items = [1];

    if (currentPage > 3) {
      items.push("ellipsis-start");
    }

    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      items.push(i);
    }

    if (currentPage < totalPages - 2) {
      items.push("ellipsis-end");
    }

    items.push(totalPages);

    return items;
  };

  /* ============================================================
     SELECTION
     ============================================================ */

  const toggleSelection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const allCurrentPageSelected =
    paginatedImages.length > 0 &&
    paginatedImages.every((img) => selectedIds.includes(img.id));

  const toggleSelectAll = () => {
    const currentPageIds = paginatedImages.map((img) => img.id);

    if (allCurrentPageSelected) {
      // Remove only this page's selections.
      setSelectedIds((prev) =>
        prev.filter((id) => !currentPageIds.includes(id)),
      );
    } else {
      // Add this page's images while preserving selections
      // from other pages.
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...currentPageIds])),
      );
    }
  };

  /* ============================================================
     LOGIN SCREEN
     ============================================================ */

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-700"
        >
          <h1 className="text-2xl font-bold text-white mb-6 text-center">
            Admin Login
          </h1>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Admin ID"
              value={credentials.id}
              onChange={(e) =>
                setCredentials({
                  ...credentials,
                  id: e.target.value,
                })
              }
              className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
              required
            />

            <input
              type="password"
              placeholder="Admin Password"
              value={credentials.password}
              onChange={(e) =>
                setCredentials({
                  ...credentials,
                  password: e.target.value,
                })
              }
              className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

          <button
            type="submit"
            className="w-full mt-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition shadow-lg shadow-red-600/20"
          >
            Sign In
          </button>
        </form>
      </div>
    );
  }

  /* ============================================================
     MAIN DASHBOARD
     ============================================================ */

  return (
    <div className="min-h-screen bg-gray-50 pb-[96px]">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900">
            Admin Dashboard — {allIds.length} images
          </h1>

          {!showVisitors && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allCurrentPageSelected}
                onChange={toggleSelectAll}
                className="w-5 h-5 accent-red-600 rounded cursor-pointer"
              />
              Select All
            </label>
          )}

          <div className="flex gap-2 flex-wrap">
            {!showVisitors && (
              <>
                <button
                  onClick={downloadSelected}
                  disabled={downloadingAll || selectedIds.length === 0}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-30"
                >
                  Download Selected ({selectedIds.length})
                </button>

                <button
                  onClick={deleteSelected}
                  disabled={selectedIds.length === 0}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-30"
                >
                  Delete Selected ({selectedIds.length})
                </button>

                <button
                  onClick={downloadAllAsZip}
                  disabled={downloadingAll}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                >
                  {downloadingAll ? "Zipping..." : "Download All (ZIP)"}
                </button>
              </>
            )}

            <button
              onClick={() => setShowVisitors((prev) => !prev)}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition"
            >
              {showVisitors ? "Back to Gallery" : "View Visitors"}
            </button>

            {!showVisitors && (
              <button
                onClick={() => setShowLiveUsers((prev) => !prev)}
                className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition"
              >
                {showLiveUsers ? "Back to Gallery" : "Live Users"}
              </button>
            )}

            {deleting && (
              <span className="text-xs text-red-600 font-medium px-2 py-2">
                Deleting...
              </span>
            )}

            <button
              onClick={() => {
                setLoggedIn(false);
                sessionStorage.removeItem("admin_logged_in");
              }}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {showVisitors ?
          <div>
            <h2 className="text-2xl font-bold mb-4">Visitors Dashboard</h2>

            {visitorsLoading ?
              <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white p-6 rounded-xl border shadow-sm animate-pulse"
                  >
                    <div className="h-6 w-1/3 bg-gray-200 rounded mb-4" />
                    <div className="h-4 w-1/4 bg-gray-200 rounded" />
                    <div className="h-4 w-2/3 bg-gray-100 rounded mt-2" />
                  </div>
                ))}
              </div>
            : <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {visitors.map((visitor, index) => (
                  <div
                    key={`${visitor.ip}-${index}`}
                    className="bg-white p-6 rounded-xl border shadow-sm"
                  >
                    <div className="flex justify-between items-center flex-wrap gap-3">
                      <h3 className="text-lg font-medium break-all">
                        {visitor.ip}
                      </h3>

                      <span className="text-sm text-gray-500">
                        Total Visits: {visitor.visitCount || visitor.visits.length}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mt-1">
                      Latest Visit:{" "}
                      <span className="font-medium text-gray-800">
                        {visitor.visits && visitor.visits.length > 0
                          ? formatDate(Math.max(...visitor.visits))
                          : formatDate(visitor.firstVisit)}
                      </span>
                    </p>

                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(visitor.ip);
                        alert("IP copied");
                      }}
                      className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg mt-2 w-fit"
                    >
                      Copy IP
                    </button>

                    <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                      <p className="font-semibold text-gray-800 mb-1">
                        IP Details
                      </p>

                      {ipDetails[visitor.ip] ? (
                        <>
                          <p>
                            Country:{" "}
                            {ipDetails[visitor.ip].country_name || "N/A"}
                          </p>
                          <p>City: {ipDetails[visitor.ip].city || "N/A"}</p>
                          <p>Region: {ipDetails[visitor.ip].region || "N/A"}</p>
                          <p>ISP: {ipDetails[visitor.ip].org || "N/A"}</p>
                          <p>
                            Timezone: {ipDetails[visitor.ip].timezone || "N/A"}
                          </p>
                        </>
                      ) : <p className="text-gray-400">Loading details...</p>}
                    </div>

                    <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                      <p className="font-semibold text-gray-800 mb-1">
                        Images Viewed ({visitor.imagesViewed?.length || 0})
                      </p>

                      {visitor.imagesViewed && visitor.imagesViewed.length > 0 ? (
                        <div className="max-h-24 overflow-y-auto space-y-1">
                          {visitor.imagesViewed.map((view, i) => (
                            <div
                              key={i}
                              className="flex justify-between border-b border-gray-100 py-1 last:border-b-0"
                            >
                              <span className="text-gray-500 text-xs truncate">
                                Image {view.imageId}
                              </span>
                              <span className="text-gray-700 text-xs">
                                {formatDate(view.viewedAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-xs">No image views recorded.</p>
                      )}
                    </div>

                    <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                      <p className="font-semibold text-gray-800 mb-1">
                        Visit Log
                      </p>

                      <div className="max-h-24 overflow-y-auto space-y-0">
                        {(visitor.visits && visitor.visits.length > 0
                          ? visitor.visits
                          : visitor.imagesViewed.map((v) => v.viewedAt)
                        ).map((v, i) => (
                          <div
                            key={i}
                            className="flex justify-between border-b border-gray-100 py-1 last:border-b-0"
                          >
                            <span className="text-gray-500 text-xs">
                              Visit {i + 1}
                            </span>

                            <span className="text-gray-700 text-xs">
                              {formatDate(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }
          </div>
        : showLiveUsers ?
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Live Users</h2>
              <p className="text-gray-600 text-sm">
                Users currently viewing images (auto-updates when they leave)
              </p>
              {liveUsersLoading ? (
                <p className="text-center py-4 text-gray-500">Loading live users…</p>
              ) : Object.keys(liveUsers).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-gray-500 text-sm">No one is viewing images right now.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(liveUsers).map(([sessionId, user]) => (
                    <div key={sessionId} className="bg-white p-6 rounded-xl border shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            Session {sessionId.slice(-6)}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Viewing image:{" "}
                            <span className="font-mono text-xs">{user.imageId}</span>
                          </p>
                          {user.ip && (
                            <p className="text-sm text-gray-500 mt-1">
                              IP:{" "}
                              <span className="font-mono text-xs">{user.ip}</span>
                            </p>
                          )}
                        </div>
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      </div>
                      <div className="mt-4 bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                        <p className="font-semibold text-gray-800 mb-1">
                          View Details
                        </p>
                        <p>
                          Started: <span className="text-gray-600">{formatDate(user.startedAt)}</span>
                        </p>
                        <p>
                          Duration:{" "}
                          <span className="text-gray-600">
                            {Math.round((Date.now() - user.startedAt) / 1000)}s ago
                          </span>
                        </p>
                        {user.ipDetails && (
                          <>
                            <p className="font-semibold text-gray-800 mb-1 mt-2">
                              IP Location
                            </p>
                            <p>Country: {user.ipDetails.country_name || "N/A"}</p>
                            <p>City: {user.ipDetails.city || "N/A"}</p>
                            <p>Region: {user.ipDetails.region || "N/A"}</p>
                            <p>ISP: {user.ipDetails.org || "N/A"}</p>
                            <p>Timezone: {user.ipDetails.timezone || "N/A"}</p>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        : loading ?
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-pulse"
              >
                <div className="w-full h-48 bg-gray-200" />

                <div className="p-4 space-y-4">
                  <div className="h-4 w-2/3 bg-gray-200 rounded" />
                  <div className="h-4 w-1/3 bg-gray-100 rounded" />

                  <div className="flex gap-2 pt-2">
                    <div className="flex-1 h-8 bg-gray-200 rounded-lg" />
                    <div className="flex-1 h-8 bg-gray-200 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        : <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedImages.map((img) => (
                <div
                  key={img.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition ${
                    selectedIds.includes(img.id) ?
                      "ring-2 ring-red-500 border-red-300"
                    : "border-gray-200"
                  }`}
                >
                  <div className="relative">
                    <label className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur rounded-md shadow-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(img.id)}
                        onChange={() => toggleSelection(img.id)}
                        className="w-5 h-5 accent-red-600 rounded cursor-pointer"
                      />
                    </label>

                    <img
                      src={img.url}
                      alt={img.displayName}
                      loading="lazy"
                      onClick={() => setFullscreenUrl(img.url)}
                      className="w-full h-48 object-contain bg-gray-50 cursor-pointer"
                    />

                    <span
                      className={`absolute top-3 left-3 px-2.5 py-0.5 text-xs font-bold rounded-full ${
                        img.visible ?
                          "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                      }`}
                    >
                      {img.visible ? "Visible" : "Hidden"}
                    </span>
                  </div>

                  <div className="p-4 space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Display Name
                      </label>

                      <input
                        type="text"
                        value={img.displayName}
                        readOnly
                        disabled
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-50/50 border border-gray-200 text-sm text-gray-400 focus:outline-none cursor-not-allowed"
                      />
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-400 font-mono truncate">
                        {img.id}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <div className="group relative flex-1">
                        <button
                          onClick={() => deleteImage(img.id)}
                          className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center justify-center"
                        >
                          <Trash2 size={16} />
                        </button>

                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          Delete
                        </span>
                      </div>

                      <div className="group relative flex-1">
                        <button
                          onClick={() => togglePin(img.id, img.pinned)}
                          className={`w-full py-2 rounded-lg text-sm font-medium transition flex items-center justify-center ${
                            img.pinned ?
                              "bg-yellow-500 hover:bg-yellow-600 text-white"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                          }`}
                        >
                          <Pin size={16} />
                        </button>

                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {img.pinned ? "Unpin" : "Pin"}
                        </span>
                      </div>

                      <div className="group relative flex-1">
                        <button
                          onClick={() => setFullscreenUrl(img.url)}
                          className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition flex items-center justify-center"
                        >
                          <Maximize2 size={16} />
                        </button>

                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          Full Screen
                        </span>
                      </div>

                      <div className="group relative flex-1">
                        <button
                          onClick={() =>
                            downloadImage(img.url, img.displayName || img.id)
                          }
                          className="w-full py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition flex items-center justify-center"
                        >
                          <Download size={16} />
                        </button>

                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          Download
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50">
                <div className="max-w-xl mx-auto flex items-center justify-between gap-2 px-4 py-3">
                  <button
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
                  >
                    <span aria-hidden="true">←</span>
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  <div className="flex items-center gap-1 overflow-x-auto">
                    {paginationItems().map((item, index) => {
                      if (
                        item === "ellipsis-start" ||
                        item === "ellipsis-end"
                      ) {
                        return (
                          <span
                            key={`${item}-${index}`}
                            className="px-2 text-gray-400 select-none text-sm shrink-0"
                          >
                            …
                          </span>
                        );
                      }

                      const active = item === currentPage;

                      return (
                        <button
                          key={item}
                          onClick={() => setCurrentPage(item)}
                          className={`min-w-[36px] h-[36px] px-2 rounded-lg text-sm font-medium transition shrink-0 ${
                            active ?
                              "bg-red-600 text-white shadow-md shadow-red-600/20"
                            : "bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                          }`}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition bg-gray-50 hover:bg-gray-100 text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>
            )}

            {!loading && paginatedImages.length === 0 && allIds.length > 0 && (
              <div className="text-center py-12 text-gray-500">
                No images found on this page.
              </div>
            )}
          </>
        }
      </main>

      {/* FULL SCREEN IMAGE VIEWER */}
      {fullscreenUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => setFullscreenUrl(null)}
        >
          <img
            src={fullscreenUrl}
            alt="Full screen"
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            onClick={() => setFullscreenUrl(null)}
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full px-3 py-1 text-sm"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
