import { useEffect, useMemo, useState } from "react";
import { ref, listAll, getDownloadURL, deleteObject } from "firebase/storage";
import { storage, database } from "../firebase";
import { ref as dbRef, set, get, remove, onValue } from "firebase/database";
import JSZip from "jszip";
import {
  Trash2,
  Pin,
  Download,
  Maximize2,
  Search,
  Users,
  Radio,
  X,
  Eye,
  MapPin,
  Copy,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { saveAs } from "file-saver";

const PAGE_SIZE = 12;

/* ============================================================
   HELPERS
   ============================================================ */

const formatDate = (timestamp) => {
  if (!timestamp) return "Unknown";

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDuration = (timestamp) => {
  if (!timestamp) return "Unknown";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  return `${hours}h ago`;
};

const getIpDetails = (visitor, log = {}) => {
  return (
    visitor.ipDetails ||
    visitor.ipInfo ||
    visitor.location ||
    log.ipDetails ||
    log.ipInfo ||
    log.location ||
    {}
  );
};

const getDetailValue = (details, ...keys) => {
  for (const key of keys) {
    if (
      details &&
      details[key] !== undefined &&
      details[key] !== null &&
      details[key] !== ""
    ) {
      return details[key];
    }
  }

  return null;
};

/* ============================================================
   COMPONENT
   ============================================================ */

export default function Admin() {
  /* ============================================================
     AUTH
     ============================================================ */

  const [loggedIn, setLoggedIn] = useState(() => {
    return sessionStorage.getItem("admin_logged_in") === "true";
  });

  const [credentials, setCredentials] = useState({
    id: "",
    password: "",
  });

  /* ============================================================
     GALLERY STATE
     ============================================================ */

  const [allIds, setAllIds] = useState([]);
  const [dbSettings, setDbSettings] = useState({});
  const [images, setImages] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const [currentPage, setCurrentPage] = useState(() => {
    return Math.max(1, Number(localStorage.getItem("admin_page")) || 1);
  });

  const [downloadingAll, setDownloadingAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ============================================================
     VISITORS
     ============================================================ */

  const [showVisitors, setShowVisitors] = useState(false);
  const [visitors, setVisitors] = useState([]);
  const [visitorsLoading, setVisitorsLoading] = useState(false);
  const [deletingVisitor, setDeletingVisitor] = useState(null);

  /* ============================================================
     LIVE USERS
     ============================================================ */

  const LIVE_USER_TIMEOUT = 60 * 1000;

  const [showLiveUsers, setShowLiveUsers] = useState(false);
  const [liveUsers, setLiveUsers] = useState({});
  const [liveUsersLoading, setLiveUsersLoading] = useState(false);

  /* ============================================================
     MODAL
     ============================================================ */

  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [openingImage, setOpeningImage] = useState(null);

  /* ============================================================
     LOGIN
     ============================================================ */

  const handleLogin = (event) => {
    event.preventDefault();

    if (
      credentials.id === process.env.REACT_APP_ADMIN_ID &&
      credentials.password === process.env.REACT_APP_ADMIN_PASSWORD
    ) {
      setLoggedIn(true);
      sessionStorage.setItem("admin_logged_in", "true");
      setError("");
      return;
    }

    setError("Invalid credentials");
  };

  const handleLogout = () => {
    setLoggedIn(false);
    sessionStorage.removeItem("admin_logged_in");
  };

  /* ============================================================
     LOAD IMAGE IDS + SETTINGS
     ============================================================ */

  useEffect(() => {
    if (!loggedIn) return;

    let cancelled = false;

    const loadGallery = async () => {
      setLoading(true);
      setError("");

      try {
        const rootResult = await listAll(ref(storage));

        const imagesFolder = rootResult.prefixes.find(
          (folder) => folder.name === "images",
        );

        if (!imagesFolder) {
          if (!cancelled) {
            setAllIds([]);
            setDbSettings({});
            setImages([]);
          }
          return;
        }

        const imagesResult = await listAll(imagesFolder);

        const settingsSnapshot = await get(dbRef(database, "gallerySettings"));

        const settings =
          settingsSnapshot.exists() ? settingsSnapshot.val() : {};

        const ids = imagesResult.items.map((item) => item.name);

        /*
         * Gallery only contains visible images.
         * If you later want hidden images visible to admins,
         * remove this filter.
         */
        const visibleIds = ids.filter((id) => settings[id]?.visible !== false);

        const pinnedIds = visibleIds.filter(
          (id) => settings[id]?.pinned === true,
        );

        const regularIds = visibleIds.filter(
          (id) => settings[id]?.pinned !== true,
        );

        const sortedIds = [...pinnedIds, ...regularIds];

        if (!cancelled) {
          setDbSettings(settings);
          setAllIds(sortedIds);
        }
      } catch (err) {
        console.error("Failed to load gallery:", err);

        if (!cancelled) {
          setError("Failed to load gallery data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGallery();

    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  /* ============================================================
     SEARCH
     ============================================================ */

  /*
   * Search happens against ALL image IDs and display names,
   * before pagination is calculated.
   */
  const filteredIds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return allIds;

    return allIds.filter((id) => {
      const displayName = dbSettings[id]?.displayName || "";

      return (
        id.toLowerCase().includes(term) ||
        displayName.toLowerCase().includes(term)
      );
    });
  }, [allIds, dbSettings, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredIds.length / PAGE_SIZE));

  /*
   * Reset search results to page 1.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  /*
   * Make sure current page never points to a page that no longer exists.
   */
  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(1, page), totalPages));
  }, [totalPages]);

  /* ============================================================
     LOAD CURRENT PAGE URLS
     ============================================================ */

  useEffect(() => {
    if (!loggedIn) return;

    let cancelled = false;

    const loadPageImages = async () => {
      if (filteredIds.length === 0) {
        setImages([]);
        return;
      }

      setLoading(true);

      try {
        const start = (currentPage - 1) * PAGE_SIZE;

        const pageIds = filteredIds.slice(start, start + PAGE_SIZE);

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
              console.error(`Failed to load image ${id}:`, err);
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
          setError("Failed to load images.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPageImages();

    return () => {
      cancelled = true;
    };
  }, [loggedIn, filteredIds, currentPage, dbSettings]);

  /* ============================================================
     PERSIST PAGE
     ============================================================ */

  useEffect(() => {
    localStorage.setItem("admin_page", String(currentPage));
  }, [currentPage]);

  /* ============================================================
     LOAD VISITORS
     ============================================================ */

  /* ============================================================
   LOAD VISITORS
   ============================================================ */

  useEffect(() => {
    if (!showVisitors || !loggedIn) return;

    let cancelled = false;

    const loadVisitors = async () => {
      setVisitorsLoading(true);

      try {
        const [visitorsSnapshot, viewLogsSnapshot] = await Promise.all([
          get(dbRef(database, "visitors")),
          get(dbRef(database, "viewLogs")),
        ]);

        const visitorsData =
          visitorsSnapshot.exists() ? visitorsSnapshot.val() : {};

        const viewLogsData =
          viewLogsSnapshot.exists() ? viewLogsSnapshot.val() : {};

        const ipMap = {};

        /*
         * Load visitor records and preserve all IP details.
         */
        Object.entries(visitorsData).forEach(([visitorKey, visitor]) => {
          if (!visitor) return;

          const ip = visitor.ip || visitorKey || "unknown";

          const visitValues =
            visitor.visits ? Object.values(visitor.visits) : [];

          ipMap[ip] = {
            key: visitorKey,
            ip,
            firstVisit: visitor.firstVisit || visitValues[0] || Date.now(),
            visits: visitValues,
            visitCount: visitValues.length,
            imagesViewed: [],

            /*
             * Preserve IP and visitor information.
             */
            ipDetails:
              visitor.ipDetails || visitor.ipInfo || visitor.location || {},

            city: visitor.city || null,
            region: visitor.region || visitor.regionName || null,
            country: visitor.country || visitor.countryName || null,
            postal: visitor.postal || visitor.zip || null,
            latitude: visitor.latitude || visitor.lat || null,
            longitude: visitor.longitude || visitor.lon || null,
            isp: visitor.isp || visitor.org || visitor.organization || null,
            userAgent: visitor.userAgent || null,
          };
        });

        /*
         * Merge image view logs and preserve any IP details
         * that may exist inside individual logs.
         */
        Object.entries(viewLogsData).forEach(([imageKey, imageLogs]) => {
          if (!imageLogs) return;

          Object.entries(imageLogs).forEach(([logKey, log]) => {
            if (!log) return;

            const ip = log.ip || log.sessionId || "unknown";

            if (!ipMap[ip]) {
              ipMap[ip] = {
                key: null,
                ip,
                firstVisit: log.viewedAt || Date.now(),
                visits: [],
                visitCount: 0,
                imagesViewed: [],

                ipDetails: log.ipDetails || log.ipInfo || log.location || {},

                city: log.city || null,
                region: log.region || log.regionName || null,
                country: log.country || log.countryName || null,
                postal: log.postal || log.zip || null,
                latitude: log.latitude || log.lat || null,
                longitude: log.longitude || log.lon || null,
                isp: log.isp || log.org || log.organization || null,
                userAgent: log.userAgent || null,
              };
            } else {
              /*
               * Fill in missing details from the view log.
               * Existing visitor details always take priority.
               */
              const existing = ipMap[ip];

              if (
                Object.keys(existing.ipDetails || {}).length === 0 &&
                (log.ipDetails || log.ipInfo || log.location)
              ) {
                existing.ipDetails =
                  log.ipDetails || log.ipInfo || log.location || {};
              }

              existing.city = existing.city || log.city || null;

              existing.region =
                existing.region || log.region || log.regionName || null;

              existing.country =
                existing.country || log.country || log.countryName || null;

              existing.postal =
                existing.postal || log.postal || log.zip || null;

              existing.latitude =
                existing.latitude || log.latitude || log.lat || null;

              existing.longitude =
                existing.longitude || log.longitude || log.lon || null;

              existing.isp =
                existing.isp || log.isp || log.org || log.organization || null;

              existing.userAgent = existing.userAgent || log.userAgent || null;
            }

            ipMap[ip].imagesViewed.push({
              logKey,
              imageKey,
              imageId: log.imageId || imageKey,
              viewedAt: log.viewedAt,
              sessionId: log.sessionId,
            });
          });
        });

        /*
         * Sort data.
         */
        const formatted = Object.values(ipMap).map((visitor) => {
          visitor.visits.sort((a, b) => b - a);

          visitor.imagesViewed.sort(
            (a, b) => (b.viewedAt || 0) - (a.viewedAt || 0),
          );

          return visitor;
        });

        formatted.sort((a, b) => {
          const aLatest =
            a.visits[0] || a.imagesViewed[0]?.viewedAt || a.firstVisit || 0;

          const bLatest =
            b.visits[0] || b.imagesViewed[0]?.viewedAt || b.firstVisit || 0;

          return bLatest - aLatest;
        });

        if (!cancelled) {
          setVisitors(formatted);
        }
      } catch (err) {
        console.error("Failed to load visitors:", err);
      } finally {
        if (!cancelled) {
          setVisitorsLoading(false);
        }
      }
    };

    loadVisitors();

    return () => {
      cancelled = true;
    };
  }, [showVisitors, loggedIn]);

  /* ============================================================
   LIVE USERS
   ============================================================ */

  useEffect(() => {
    if (!showLiveUsers || !loggedIn) return;

    setLiveUsersLoading(true);

    const activeUsersRef = dbRef(database, "activeUsers");

    const updateLiveUsers = (snapshot) => {
      const users = snapshot.val() || {};
      const now = Date.now();

      /*
       * Only keep users who have been active recently.
       *
       * The website should update lastActive regularly.
       * Entries older than LIVE_USER_TIMEOUT are treated
       * as inactive and are not shown in the admin dashboard.
       */
      const activeUsers = Object.fromEntries(
        Object.entries(users).filter(([_, user]) => {
          if (!user) return false;

          const lastActive =
            user.lastActive || user.updatedAt || user.startedAt || 0;

          return now - lastActive <= LIVE_USER_TIMEOUT;
        }),
      );

      setLiveUsers(activeUsers);
      setLiveUsersLoading(false);
    };

    const unsubscribe = onValue(activeUsersRef, updateLiveUsers, (err) => {
      console.error("Failed to load live users:", err);

      setLiveUsersLoading(false);
    });

    /*
     * Re-check activity periodically.
     *
     * Firebase only triggers on database changes, but a user can
     * become inactive simply because their lastActive timestamp
     * gets too old.
     */
    const interval = setInterval(() => {
      get(activeUsersRef)
        .then(updateLiveUsers)
        .catch((err) => {
          console.error("Failed to refresh live users:", err);
        });
    }, 15000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [showLiveUsers, loggedIn]);

  /* ============================================================
     IMAGE SETTINGS
     ============================================================ */

  const togglePin = async (id, currentValue) => {
    const newValue = !currentValue;

    try {
      await set(dbRef(database, `gallerySettings/${id}/pinned`), newValue);

      setDbSettings((previous) => ({
        ...previous,
        [id]: {
          ...previous[id],
          pinned: newValue,
        },
      }));

      /*
       * Keep pinned images at the beginning.
       */
      setAllIds((previous) => {
        const withoutImage = previous.filter((item) => item !== id);

        return newValue ? [id, ...withoutImage] : [...withoutImage, id];
      });
    } catch (err) {
      console.error("Failed to update pin:", err);
      alert("Failed to update image.");
    }
  };

  /* ============================================================
     SELECTION
     ============================================================ */

  const toggleSelection = (id) => {
    setSelectedIds((previous) =>
      previous.includes(id) ?
        previous.filter((item) => item !== id)
      : [...previous, id],
    );
  };

  const allCurrentPageSelected =
    images.length > 0 &&
    images.every((image) => selectedIds.includes(image.id));

  const toggleSelectAll = () => {
    const pageIds = images.map((image) => image.id);

    if (allCurrentPageSelected) {
      setSelectedIds((previous) =>
        previous.filter((id) => !pageIds.includes(id)),
      );

      return;
    }

    setSelectedIds((previous) =>
      Array.from(new Set([...previous, ...pageIds])),
    );
  };

  /* ============================================================
     DOWNLOAD
     ============================================================ */

  const downloadImage = (url, filename) => {
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const createZip = async (ids, filename) => {
    setDownloadingAll(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder("images");

      for (const id of ids) {
        const url = await getDownloadURL(ref(storage, `images/${id}`));

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to download ${id}`);
        }

        const blob = await response.blob();

        const settings = dbSettings[id] || {};

        folder.file(settings.displayName || id, blob);
      }

      const content = await zip.generateAsync({
        type: "blob",
      });

      saveAs(content, filename);
    } catch (err) {
      console.error("ZIP download failed:", err);
      alert("Failed to create ZIP.");
    } finally {
      setDownloadingAll(false);
    }
  };

  const downloadAllAsZip = () => {
    createZip(allIds, "gallery-images.zip");
  };

  const downloadSelected = () => {
    if (selectedIds.length === 0) return;

    createZip(selectedIds, "selected-images.zip");
  };

  /* ============================================================
     DELETE IMAGES
     ============================================================ */

  const deleteImage = async (id) => {
    if (!window.confirm(`Delete image "${id}" permanently?`)) {
      return;
    }

    setDeleting(true);

    try {
      await deleteObject(ref(storage, `images/${id}`));

      await remove(dbRef(database, `gallerySettings/${id}`));

      setAllIds((previous) => previous.filter((item) => item !== id));

      setSelectedIds((previous) => previous.filter((item) => item !== id));

      setDbSettings((previous) => {
        const updated = { ...previous };
        delete updated[id];
        return updated;
      });
    } catch (err) {
      console.error("Failed to delete image:", err);
      alert("Failed to delete image.");
    } finally {
      setDeleting(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;

    if (
      !window.confirm(
        `Delete ${selectedIds.length} selected image(s) permanently?`,
      )
    ) {
      return;
    }

    setDeleting(true);

    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          await deleteObject(ref(storage, `images/${id}`));

          await remove(dbRef(database, `gallerySettings/${id}`));
        }),
      );

      setAllIds((previous) =>
        previous.filter((id) => !selectedIds.includes(id)),
      );

      setDbSettings((previous) => {
        const updated = { ...previous };

        selectedIds.forEach((id) => {
          delete updated[id];
        });

        return updated;
      });

      setSelectedIds([]);
    } catch (err) {
      console.error("Failed to delete selected images:", err);

      alert("Some images may not have been deleted.");
    } finally {
      setDeleting(false);
    }
  };

  /* ============================================================
     OPEN IMAGE FROM VISITOR LOG
     ============================================================ */

  const openVisitorImage = async (imageId) => {
    if (!imageId) return;

    setOpeningImage(imageId);

    try {
      const url = await getDownloadURL(ref(storage, `images/${imageId}`));

      setFullscreenImage({
        url,
        name: dbSettings[imageId]?.displayName || imageId,
      });
    } catch (err) {
      console.error("Failed to open visitor image:", err);

      alert("This image could not be found. It may have been deleted.");
    } finally {
      setOpeningImage(null);
    }
  };

  /* ============================================================
     DELETE VISITOR
     ============================================================ */

  const deleteVisitor = async (visitor) => {
    if (!window.confirm(`Delete all stored visitor data for ${visitor.ip}?`)) {
      return;
    }

    setDeletingVisitor(visitor.ip);

    try {
      /*
       * Remove visitor record.
       */
      if (visitor.key) {
        await remove(dbRef(database, `visitors/${visitor.key}`));
      }

      /*
       * Remove associated image view logs.
       *
       * We use the exact image/log keys collected
       * when building the visitor dashboard.
       */
      await Promise.all(
        visitor.imagesViewed.map(async (view) => {
          if (view.imageKey && view.logKey) {
            await remove(
              dbRef(database, `viewLogs/${view.imageKey}/${view.logKey}`),
            );
          }
        }),
      );

      setVisitors((previous) =>
        previous.filter((item) => item.ip !== visitor.ip),
      );
    } catch (err) {
      console.error("Failed to delete visitor:", err);

      alert("Failed to delete visitor data.");
    } finally {
      setDeletingVisitor(null);
    }
  };

  /* ============================================================
     PAGINATION
     ============================================================ */

  const paginationItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const items = [1];

    if (currentPage > 3) {
      items.push("ellipsis-start");
    }

    const start = Math.max(2, currentPage - 1);

    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let page = start; page <= end; page++) {
      items.push(page);
    }

    if (currentPage < totalPages - 2) {
      items.push("ellipsis-end");
    }

    items.push(totalPages);

    return items;
  };

  /* ============================================================
     LOGIN SCREEN
     ============================================================ */

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl"
        >
          <div className="text-center mb-8">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-600 flex items-center justify-center">
              <ImageIcon size={22} className="text-white" />
            </div>

            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>

            <p className="text-sm text-gray-400 mt-2">
              Sign in to manage your gallery.
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Admin ID"
              value={credentials.id}
              onChange={(event) =>
                setCredentials((previous) => ({
                  ...previous,
                  id: event.target.value,
                }))
              }
              className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />

            <input
              type="password"
              placeholder="Admin Password"
              value={credentials.password}
              onChange={(event) =>
                setCredentials((previous) => ({
                  ...previous,
                  password: event.target.value,
                }))
              }
              className="w-full px-4 py-3 rounded-xl bg-gray-950 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            className="w-full mt-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition"
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
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ========================================================
          HEADER
         ======================================================== */}

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Admin Dashboard
              </h1>

              <p className="text-sm text-gray-500">
                {showVisitors ?
                  `${visitors.length} tracked visitors`
                : showLiveUsers ?
                  `${Object.keys(liveUsers).length} live users`
                : `${allIds.length} images in gallery`}
              </p>
            </div>

            {/* SEARCH */}
            {!showVisitors && !showLiveUsers && (
              <div className="relative w-full lg:w-80">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />

                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search images..."
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition"
                />

                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    title="Clear search"
                  >
                    <X size={17} />
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {!showVisitors && !showLiveUsers && (
                <>
                  <label className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-red-600"
                    />
                    Select Page
                  </label>

                  <button
                    onClick={downloadSelected}
                    disabled={downloadingAll || selectedIds.length === 0}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-40"
                  >
                    Download ({selectedIds.length})
                  </button>

                  <button
                    onClick={deleteSelected}
                    disabled={deleting || selectedIds.length === 0}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-40"
                  >
                    Delete ({selectedIds.length})
                  </button>

                  <button
                    onClick={downloadAllAsZip}
                    disabled={downloadingAll}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-40"
                  >
                    {downloadingAll ? "Creating ZIP..." : "Download All"}
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setShowVisitors((previous) => {
                    const next = !previous;

                    if (next) {
                      setShowLiveUsers(false);
                    }

                    return next;
                  });
                }}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition flex items-center gap-2 ${
                  showVisitors ?
                    "bg-purple-700 text-white"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
                }`}
              >
                <Users size={16} />

                {showVisitors ? "Gallery" : "Visitors"}
              </button>

              {!showVisitors && (
                <button
                  onClick={() => {
                    setShowLiveUsers((previous) => !previous);
                  }}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition flex items-center gap-2 ${
                    showLiveUsers ?
                      "bg-orange-700 text-white"
                    : "bg-orange-600 hover:bg-orange-700 text-white"
                  }`}
                >
                  <Radio size={16} />

                  {showLiveUsers ? "Gallery" : "Live Users"}
                </button>
              )}

              <button
                onClick={handleLogout}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium rounded-lg transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* ======================================================
            ERROR
           ====================================================== */}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ======================================================
            VISITORS
           ====================================================== */}

        {showVisitors ?
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Visitors</h2>

                <p className="text-sm text-gray-500 mt-1">
                  Visitor activity and image viewing history.
                </p>
              </div>
            </div>

            {visitorsLoading ?
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {Array.from({
                  length: 4,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-white border rounded-2xl p-6 animate-pulse"
                  >
                    <div className="h-6 w-1/3 bg-gray-200 rounded mb-5" />
                    <div className="h-4 w-2/3 bg-gray-100 rounded mb-3" />
                    <div className="h-24 bg-gray-100 rounded-xl" />
                  </div>
                ))}
              </div>
            : visitors.length === 0 ?
              <div className="bg-white border border-dashed border-gray-300 rounded-2xl py-16 text-center">
                <Users size={32} className="mx-auto text-gray-300 mb-3" />

                <p className="text-gray-500">No visitor data recorded yet.</p>
              </div>
            : <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {visitors.map((visitor) => {
                  const latestVisit =
                    visitor.visits[0] ||
                    visitor.imagesViewed[0]?.viewedAt ||
                    visitor.firstVisit;

                  return (
                    <div
                      key={visitor.ip}
                      className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
                    >
                      {/* VISITOR HEADER */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <MapPin
                              size={17}
                              className="text-purple-600 shrink-0"
                            />

                            <h3 className="font-semibold text-gray-900 font-mono text-sm break-all">
                              {visitor.ip}
                            </h3>
                          </div>

                          <p className="text-sm text-gray-500 mt-2">
                            Latest activity:{" "}
                            <span className="text-gray-700">
                              {formatDate(latestVisit)}
                            </span>
                          </p>
                        </div>

                        <button
                          onClick={() => deleteVisitor(visitor)}
                          disabled={deletingVisitor === visitor.ip}
                          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition disabled:opacity-50"
                          title="Delete visitor data"
                        >
                          {deletingVisitor === visitor.ip ?
                            <Loader2 size={17} className="animate-spin" />
                          : <Trash2 size={17} />}
                        </button>
                      </div>

                      {/* IP DETAILS */}
                      {(() => {
                        const details = visitor.ipDetails || {};

                        const city =
                          visitor.city || getDetailValue(details, "city");

                        const region =
                          visitor.region ||
                          getDetailValue(details, "region", "regionName");

                        const country =
                          visitor.country ||
                          getDetailValue(
                            details,
                            "country",
                            "country_name",
                            "countryName",
                          );

                        const postal =
                          visitor.postal ||
                          getDetailValue(details, "postal", "zip");

                        const latitude =
                          visitor.latitude ||
                          getDetailValue(details, "latitude", "lat");

                        const longitude =
                          visitor.longitude ||
                          getDetailValue(details, "longitude", "lon", "lng");

                        const isp =
                          visitor.isp ||
                          getDetailValue(details, "isp", "org", "organization");

                        const userAgent =
                          visitor.userAgent ||
                          getDetailValue(details, "userAgent", "user_agent");

                        const hasDetails =
                          city ||
                          region ||
                          country ||
                          postal ||
                          latitude ||
                          longitude ||
                          isp ||
                          userAgent ||
                          Object.keys(details).length > 0;

                        if (!hasDetails) return null;

                        return (
                          <div className="mt-5 bg-purple-50 border border-purple-100 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <MapPin size={16} className="text-purple-600" />

                              <h4 className="text-sm font-semibold text-gray-800">
                                IP Details
                              </h4>
                            </div>

                            <div className="space-y-2 text-sm">
                              {/* Keep the actual IP prominently visible */}
                              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                <span className="text-gray-500">
                                  IP Address
                                </span>

                                <span className="font-mono text-xs text-gray-900 break-all">
                                  {visitor.ip}
                                </span>
                              </div>

                              {(city || region || country) && (
                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                  <span className="text-gray-500">
                                    Location
                                  </span>

                                  <span className="text-gray-800 text-right">
                                    {[city, region, country]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </span>
                                </div>
                              )}

                              {postal && (
                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                  <span className="text-gray-500">
                                    Postal Code
                                  </span>

                                  <span className="text-gray-800">
                                    {postal}
                                  </span>
                                </div>
                              )}

                              {(latitude || longitude) && (
                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                  <span className="text-gray-500">
                                    Coordinates
                                  </span>

                                  <span className="font-mono text-xs text-gray-800">
                                    {latitude || "?"}, {longitude || "?"}
                                  </span>
                                </div>
                              )}

                              {isp && (
                                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                  <span className="text-gray-500">
                                    Network / ISP
                                  </span>

                                  <span className="text-gray-800 text-right break-all">
                                    {isp}
                                  </span>
                                </div>
                              )}

                              {userAgent && (
                                <div className="pt-2 mt-2 border-t border-purple-100">
                                  <p className="text-xs text-gray-500 mb-1">
                                    User Agent
                                  </p>

                                  <p className="font-mono text-[11px] leading-relaxed text-gray-700 break-all">
                                    {userAgent}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* STATS */}
                      <div className="grid grid-cols-2 gap-3 mt-5">
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500">Visits</p>

                          <p className="text-xl font-bold text-gray-900 mt-1">
                            {visitor.visitCount}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-500">Images Viewed</p>

                          <p className="text-xl font-bold text-gray-900 mt-1">
                            {visitor.imagesViewed.length}
                          </p>
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(visitor.ip);
                            } catch (err) {
                              console.error("Failed to copy IP:", err);
                            }
                          }}
                          className="flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition"
                        >
                          <Copy size={15} />
                          Copy IP
                        </button>
                      </div>

                      {/* IMAGES VIEWED */}
                      <div className="mt-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Eye size={16} className="text-gray-500" />

                          <h4 className="text-sm font-semibold text-gray-800">
                            Images Viewed
                          </h4>
                        </div>

                        {visitor.imagesViewed.length > 0 ?
                          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {visitor.imagesViewed.map((view) => (
                              <button
                                key={`${view.imageKey}-${view.logKey}`}
                                onClick={() => openVisitorImage(view.imageId)}
                                disabled={openingImage === view.imageId}
                                className="w-full flex items-center justify-between gap-3 text-left bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-xl px-3 py-3 transition disabled:opacity-60"
                              >
                                <div className="min-w-0 flex items-center gap-3">
                                  {openingImage === view.imageId ?
                                    <Loader2
                                      size={16}
                                      className="animate-spin text-blue-600 shrink-0"
                                    />
                                  : <ImageIcon
                                      size={16}
                                      className="text-blue-600 shrink-0"
                                    />
                                  }

                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">
                                      {dbSettings[view.imageId]?.displayName ||
                                        view.imageId}
                                    </p>

                                    <p className="text-xs text-gray-500">
                                      {formatDate(view.viewedAt)}
                                    </p>
                                  </div>
                                </div>

                                <Maximize2
                                  size={15}
                                  className="text-gray-400 shrink-0"
                                />
                              </button>
                            ))}
                          </div>
                        : <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">
                            No image views recorded.
                          </p>
                        }
                      </div>

                      {/* VISIT LOG */}
                      {visitor.visits.length > 0 && (
                        <div className="mt-5">
                          <h4 className="text-sm font-semibold text-gray-800 mb-3">
                            Visit History
                          </h4>

                          <div className="max-h-32 overflow-y-auto border rounded-xl divide-y">
                            {visitor.visits.map((visit, index) => (
                              <div
                                key={`${visit}-${index}`}
                                className="flex items-center justify-between px-3 py-2 text-xs"
                              >
                                <span className="text-gray-500">
                                  Visit {visitor.visits.length - index}
                                </span>

                                <span className="text-gray-700">
                                  {formatDate(visit)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            }
          </section>
        : showLiveUsers ?
          /* ====================================================
      LIVE USERS
     ==================================================== */

          <section>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Live Users</h2>

              <p className="text-sm text-gray-500 mt-1">
                Users currently active on the site.
              </p>
            </div>

            {liveUsersLoading ?
              <div className="text-center py-16 text-gray-500">
                Loading live users...
              </div>
            : Object.keys(liveUsers).length === 0 ?
              <div className="bg-white border border-dashed border-gray-300 rounded-2xl py-16 text-center">
                <Radio size={32} className="mx-auto text-gray-300 mb-3" />

                <p className="text-gray-500">
                  No one is currently active on the site.
                </p>
              </div>
            : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {Object.entries(liveUsers).map(([sessionId, user]) => {
                  const details =
                    user.ipDetails || user.ipInfo || user.location || {};

                  const city = user.city || getDetailValue(details, "city");

                  const region =
                    user.region ||
                    user.regionName ||
                    getDetailValue(details, "region", "regionName");

                  const country =
                    user.country ||
                    user.countryName ||
                    getDetailValue(
                      details,
                      "country",
                      "country_name",
                      "countryName",
                    );

                  const postal =
                    user.postal ||
                    user.zip ||
                    getDetailValue(details, "postal", "zip");

                  const latitude =
                    user.latitude ||
                    user.lat ||
                    getDetailValue(details, "latitude", "lat");

                  const longitude =
                    user.longitude ||
                    user.lon ||
                    user.lng ||
                    getDetailValue(details, "longitude", "lon", "lng");

                  const isp =
                    user.isp ||
                    user.org ||
                    user.organization ||
                    getDetailValue(details, "isp", "org", "organization");

                  const userAgent =
                    user.userAgent ||
                    getDetailValue(details, "userAgent", "user_agent");

                  const lastActive =
                    user.lastActive || user.updatedAt || user.startedAt;

                  return (
                    <div
                      key={sessionId}
                      className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm"
                    >
                      {/* HEADER */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Radio
                              size={17}
                              className="text-green-600 shrink-0"
                            />

                            <h3 className="font-semibold text-gray-900">
                              Active User
                            </h3>
                          </div>

                          {user.imageId && (
                            <p className="text-sm text-gray-500 mt-2">
                              Currently viewing{" "}
                              <span className="font-mono text-xs text-gray-700 break-all">
                                {dbSettings[user.imageId]?.displayName ||
                                  user.imageId}
                              </span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />

                          <span className="text-xs font-medium text-green-700">
                            Live
                          </span>
                        </div>
                      </div>

                      {/* IP DETAILS */}
                      <div className="mt-5 bg-green-50 border border-green-100 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin size={16} className="text-green-600" />

                          <h4 className="text-sm font-semibold text-gray-800">
                            Connection Details
                          </h4>
                        </div>

                        <div className="space-y-2 text-sm">
                          {user.ip && (
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                              <span className="text-gray-500">IP Address</span>

                              <span className="font-mono text-xs text-gray-900 break-all">
                                {user.ip}
                              </span>
                            </div>
                          )}

                          {(city || region || country) && (
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                              <span className="text-gray-500">Location</span>

                              <span className="text-gray-800 text-right">
                                {[city, region, country]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </div>
                          )}

                          {postal && (
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                              <span className="text-gray-500">Postal Code</span>

                              <span className="text-gray-800">{postal}</span>
                            </div>
                          )}

                          {(latitude || longitude) && (
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                              <span className="text-gray-500">Coordinates</span>

                              <span className="font-mono text-xs text-gray-800">
                                {latitude || "?"}, {longitude || "?"}
                              </span>
                            </div>
                          )}

                          {isp && (
                            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                              <span className="text-gray-500">
                                Network / ISP
                              </span>

                              <span className="text-gray-800 text-right break-all">
                                {isp}
                              </span>
                            </div>
                          )}

                          {userAgent && (
                            <div className="pt-2 mt-2 border-t border-green-100">
                              <p className="text-xs text-gray-500 mb-1">
                                User Agent
                              </p>

                              <p className="font-mono text-[11px] leading-relaxed text-gray-700 break-all">
                                {userAgent}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* LIVE STATUS */}
                      <div className="mt-4 bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-gray-600">
                            Last activity
                          </span>

                          <span className="text-sm font-medium text-gray-900">
                            {formatDuration(lastActive)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </section>
          /* ====================================================
              GALLERY
             ==================================================== */
        : <section>
            {!loading && searchTerm && filteredIds.length > 0 && (
              <p className="text-sm text-gray-500 mb-5">
                Found {filteredIds.length} image
                {filteredIds.length === 1 ? "" : "s"} matching "{searchTerm}"
              </p>
            )}

            {loading ?
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {Array.from({
                  length: 8,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse"
                  >
                    <div className="h-52 bg-gray-200" />

                    <div className="p-4 space-y-3">
                      <div className="h-4 w-2/3 bg-gray-200 rounded" />
                      <div className="h-3 w-1/2 bg-gray-100 rounded" />

                      <div className="h-9 bg-gray-100 rounded-lg mt-4" />
                    </div>
                  </div>
                ))}
              </div>
            : images.length === 0 ?
              <div className="bg-white border border-dashed border-gray-300 rounded-2xl py-20 text-center">
                <Search size={32} className="mx-auto text-gray-300 mb-3" />

                <h3 className="font-medium text-gray-800">No images found</h3>

                <p className="text-sm text-gray-500 mt-1">
                  {searchTerm ?
                    "Try a different search term."
                  : "Your gallery is currently empty."}
                </p>
              </div>
            : <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`bg-white rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition ${
                        selectedIds.includes(image.id) ?
                          "border-red-400 ring-2 ring-red-500/20"
                        : "border-gray-200"
                      }`}
                    >
                      {/* IMAGE */}
                      <div className="relative bg-gray-50">
                        <button
                          onClick={() =>
                            setFullscreenImage({
                              url: image.url,
                              name: image.displayName,
                            })
                          }
                          className="block w-full"
                        >
                          <img
                            src={image.url}
                            alt={image.displayName}
                            loading="lazy"
                            className="w-full h-52 object-contain cursor-zoom-in"
                          />
                        </button>

                        <label className="absolute top-3 right-3 z-10 w-8 h-8 bg-white/95 rounded-lg shadow flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(image.id)}
                            onChange={() => toggleSelection(image.id)}
                            className="w-4 h-4 accent-red-600 cursor-pointer"
                          />
                        </label>

                        {image.pinned && (
                          <div className="absolute top-3 left-3 bg-yellow-400 text-yellow-950 rounded-lg px-2 py-1 text-xs font-semibold flex items-center gap-1">
                            <Pin size={12} />
                            Pinned
                          </div>
                        )}
                      </div>

                      {/* DETAILS */}
                      <div className="p-4">
                        <p className="font-medium text-gray-900 truncate">
                          {image.displayName}
                        </p>

                        <p className="font-mono text-xs text-gray-400 truncate mt-1">
                          {image.id}
                        </p>

                        {/* ACTIONS */}
                        <div className="grid grid-cols-4 gap-2 mt-4">
                          <button
                            onClick={() => deleteImage(image.id)}
                            disabled={deleting}
                            title="Delete image"
                            className="h-9 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>

                          <button
                            onClick={() => togglePin(image.id, image.pinned)}
                            title={image.pinned ? "Unpin image" : "Pin image"}
                            className={`h-9 rounded-lg flex items-center justify-center transition ${
                              image.pinned ?
                                "bg-yellow-500 text-white hover:bg-yellow-600"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            <Pin size={16} />
                          </button>

                          <button
                            onClick={() =>
                              setFullscreenImage({
                                url: image.url,
                                name: image.displayName,
                              })
                            }
                            title="View full screen"
                            className="h-9 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition"
                          >
                            <Maximize2 size={16} />
                          </button>

                          <button
                            onClick={() =>
                              downloadImage(
                                image.url,
                                image.displayName || image.id,
                              )
                            }
                            title="Download image"
                            className="h-9 rounded-lg bg-gray-900 text-white hover:bg-gray-700 flex items-center justify-center transition"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* PAGINATION */}
                {totalPages > 1 && (
                  <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-4 py-3">
                      <button
                        onClick={() =>
                          setCurrentPage((page) => Math.max(1, page - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        ← Prev
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
                                className="px-2 text-gray-400"
                              >
                                …
                              </span>
                            );
                          }

                          return (
                            <button
                              key={item}
                              onClick={() => setCurrentPage(item)}
                              className={`min-w-9 h-9 px-3 rounded-lg text-sm font-medium transition ${
                                item === currentPage ?
                                  "bg-red-600 text-white"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                              }`}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() =>
                          setCurrentPage((page) =>
                            Math.min(totalPages, page + 1),
                          )
                        }
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            }
          </section>
        }
      </main>

      {/* ========================================================
          IMAGE MODAL
         ======================================================== */}

      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <div
            className="relative max-w-6xl max-h-full"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={fullscreenImage.url}
              alt={fullscreenImage.name}
              className="max-w-[95vw] max-h-[85vh] object-contain rounded-xl shadow-2xl bg-black"
            />

            <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-black/70 backdrop-blur rounded-b-xl">
              <p className="text-white text-sm truncate">
                {fullscreenImage.name}
              </p>
            </div>

            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute -top-3 -right-3 w-9 h-9 bg-white text-gray-900 rounded-full shadow-lg hover:bg-gray-100 flex items-center justify-center"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
