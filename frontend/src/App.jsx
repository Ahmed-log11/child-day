import { Route, Routes } from "react-router-dom";
import AppShell from "./layout/AppShell";
import Landing from "./pages/Landing";
import Setup from "./pages/Setup";
import Upload from "./pages/Upload";
import Processing from "./pages/Processing";
import Live from "./pages/Live";
import Dashboard from "./pages/Dashboard";
import VideoReview from "./pages/VideoReview";
import Alerts from "./pages/Alerts";
import ChildProfile from "./pages/ChildProfile";
import Insights from "./pages/Insights";
import Week from "./pages/Week";
import Month from "./pages/Month";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/week" element={<Week />} />
        <Route path="/month" element={<Month />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/processing/:jobId" element={<Processing />} />
        <Route path="/live" element={<Live />} />
        <Route path="/sessions/:sessionId" element={<VideoReview />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/children/:childId" element={<ChildProfile />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
