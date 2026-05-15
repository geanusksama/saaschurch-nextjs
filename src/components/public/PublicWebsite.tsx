import { Outlet } from 'react-router';

export function PublicWebsite() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <main>
        <Outlet />
      </main>
    </div>
  );
}
