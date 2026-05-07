import { availableLabModules, defaultLabModules } from "@/app/lib/modules";

export default function DeveloperDefaultsPage() {
  const defaultModules = availableLabModules.filter((module) => defaultLabModules.includes(module.id));

  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Platform Control</p>
          <h2>Default Lab Setup</h2>
          <span>Current defaults used when a new tenant lab is created.</span>
        </div>
      </div>

      <div className="developer-two-column">
        <section className="developer-panel">
          <div className="developer-panel-header">
            <h2>Default Modules</h2>
            <p>New labs start with this baseline module bundle.</p>
          </div>
          <div className="developer-module-catalog compact">
            {defaultModules.map((module) => (
              <article key={module.id}>
                <strong>{module.label}</strong>
                <span>{module.id}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="developer-panel">
          <div className="developer-panel-header">
            <h2>Default Branding</h2>
            <p>Applied when a lab does not provide custom values.</p>
          </div>
          <div className="developer-setting-list">
            <article>
              <span>Primary Color</span>
              <strong>#0d9488</strong>
            </article>
            <article>
              <span>Secondary Color</span>
              <strong>#0f766e</strong>
            </article>
            <article>
              <span>Accent Color</span>
              <strong>#f59e0b</strong>
            </article>
            <article>
              <span>Default Plan</span>
              <strong>Trial</strong>
            </article>
          </div>
        </section>
      </div>
    </section>
  );
}
