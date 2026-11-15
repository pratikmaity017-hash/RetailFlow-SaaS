import "./app-loader.css";

export default function AppLoader() {
  return (
    <main className="app-loader">
      <div className="app-loader-content">
        <div className="app-loader-logo">
          <span>R</span>
        </div>

        <h1>RetailFlow</h1>

        <p>Preparing your workspace...</p>

        <div className="app-loader-progress">
          <span />
        </div>
      </div>
    </main>
  );
}
