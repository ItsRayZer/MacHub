import ThreeBackground from '@/components/ThreeBackground';
import RainOverlay from '@/components/RainOverlay';
import ToastContainer from '@/components/ToastContainer';
import SettingsHub from '@/components/settings/SettingsHub';
import ProfilePage from '@/sections/ProfilePage';

export default function App() {
  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Three.js Background - z-0 */}
      <ThreeBackground />

      {/* Rain Overlay - z-1 */}
      <RainOverlay />

      {/* Main Content - z-10 */}
      <div className="relative" style={{ zIndex: 10 }}>
        <ProfilePage />
      </div>

      {/* Settings Hub - z-50 */}
      <SettingsHub />

      {/* Toast Container - z-60 */}
      <ToastContainer />
    </div>
  );
}
