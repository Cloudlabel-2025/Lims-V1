import { availableLabModules, defaultLabModules } from "@/app/lib/modules";

export default function DeveloperModulesPage() {
  return (
    <section className="developer-page">
      <div className="developer-page-actions">
        <div>
          <p className="developer-kicker">Platform Control</p>
          <h2>Module Management</h2>
          <span>Review the global product modules assignable to tenant labs.</span>
        </div>
      </div>

      <section className="developer-panel">
        <div className="developer-panel-header">
          <h2>Available Modules</h2>
          <p>These modules can be enabled per lab during onboarding.</p>
        </div>
        <div className="developer-module-catalog">
          {availableLabModules.map((module) => (
            <article key={module.id}>
              <strong>{module.label}</strong>
              <span>{module.id}</span>
              <small>{module.permission}</small>
              {defaultLabModules.includes(module.id) && <em>Default</em>}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
