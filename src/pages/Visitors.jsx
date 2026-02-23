import { useEffect, useState } from "react";
import { ref, get } from "firebase/database";
import { database } from "../firebase";
import Header from "../components/Header";

export default function Visitors() {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const fetchVisitors = async () => {
      const snapshot = await get(ref(database, "visitors"));

      if (!snapshot.exists()) {
        setVisitors([]);
        setLoading(false);
        return;
      }

      const data = snapshot.val();

      const formatted = Object.values(data).map((v) => ({
        ip: v.ip,
        firstVisit: v.firstVisit,
        visits: v.visits ? Object.values(v.visits) : [],
      }));

      formatted.sort((a, b) => b.firstVisit - a.firstVisit);

      setVisitors(formatted);
      setLoading(false);
    };

    fetchVisitors();
  }, []);

  const formatTime = (ts) => new Date(ts).toLocaleString();

  const copyIp = async (ip) => {
    await navigator.clipboard.writeText(ip);
    setToast("IP copied");
    setTimeout(() => setToast(""), 2000);
  };

  const openIpApi = async (ip) => {
    await navigator.clipboard.writeText(ip);
    window.open(`https://ipapi.co/${ip}/`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header page="visitors" />

      <div className="max-w-6xl mx-auto px-4 mt-6">
        <h1 className="text-2xl font-semibold mb-6">Visitors Dashboard</h1>

        {loading && <p>Loading...</p>}

        <div className="space-y-6">
          {visitors.map((visitor, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-xl border shadow-sm"
            >
              <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-lg font-medium break-all">{visitor.ip}</h2>

                <span className="text-sm text-gray-500">
                  Total Visits: {visitor.visits.length}
                </span>
              </div>

              <p className="text-sm text-gray-600 mt-1">
                First Visit: {formatTime(visitor.firstVisit)}
              </p>

              {/* Buttons */}
              <div className="flex gap-3 mt-4 flex-wrap">
                <button
                  onClick={() => copyIp(visitor.ip)}
                  className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg"
                >
                  Copy IP
                </button>

                <button
                  onClick={() => openIpApi(visitor.ip)}
                  className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
                >
                  View Details
                </button>
              </div>

              {/* Visit History */}
              <div className="mt-4">
                <p className="text-sm font-medium mb-1">Visit History:</p>

                <ul className="text-sm text-gray-500 max-h-40 overflow-y-auto space-y-1">
                  {visitor.visits.map((v, i) => (
                    <li key={i}>{formatTime(v)}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black text-white text-sm rounded-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
