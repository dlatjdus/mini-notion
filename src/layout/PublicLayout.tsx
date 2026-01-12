import { Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <Outlet />
        </div>
        <p className="mt-4 text-center text-xs text-gray-500">
          Mini Notion • Google Login
        </p>
      </div>
    </div>
  );
}
