import { useState } from 'react'
import BitManipulationPlayground from './calculators/BitManipulationPlayground'
import ComplexNumbers from './calculators/ComplexNumbers'
import FunctionPlotter from './calculators/FunctionPlotter'
import MatrixSolver from './calculators/MatrixSolver'
import { pageTabs, tools } from './data/tools'
import './App.css'

const supportDeveloperUrl = 'https://buymeacoffee.com/vctrkarthik'
const contactEmail = 'vctrkarthik@gmail.com'

const calculatorComponents = {
  'matrix-solver': MatrixSolver,
  'complex-numbers': ComplexNumbers,
  'function-plotter': FunctionPlotter,
  'bit-manipulation-playground': BitManipulationPlayground,
}

function App() {
  const [activePage, setActivePage] = useState('tools')
  const [activeTool, setActiveTool] = useState('matrix-solver')

  const activeToolMeta = tools.find((tool) => tool.id === activeTool) ?? tools[0]
  const activePageMeta = pageTabs.find((page) => page.id === activePage) ?? pageTabs[0]

  function renderToolsPage() {
    return (
      <div className="workspace">
        <aside className="tool-nav" aria-label="Tool list">
          {tools.map((tool) => (
            <button
              className={`tool-tab ${tool.id === activeTool ? 'active' : ''}`}
              type="button"
              key={tool.id}
              aria-current={tool.id === activeTool ? 'page' : undefined}
              onClick={() => setActiveTool(tool.id)}
            >
              <span>{tool.name}</span>
              <strong>{tool.shortName}</strong>
            </button>
          ))}
          <div className="coming-soon">More calculators</div>
        </aside>

        <div className="calculator-stack">
          {tools.map((tool) => {
            const Calculator = calculatorComponents[tool.id]

            if (!Calculator) return null

            return (
              <div
                className="calculator-slot"
                key={tool.id}
                hidden={tool.id !== activeTool}
              >
                <Calculator />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderAboutPage() {
    return (
      <section className="tool-panel info-page" aria-labelledby="about-title">
        <p className="eyebrow">About</p>
        <h2 id="about-title">About EE Toolkit</h2>
        <div className="info-copy">
          <p>
            EE Toolkit is a free collection of engineering calculators and learning tools
            designed for electrical engineering students. It helps students learn and
            solve engineering problems more efficiently with tools such as matrix solvers
            and complex number calculators.
          </p>
          <p>
            The toolkit is continuously updated with new features based on student
            feedback, including planned support for AC circuit analysis, filter design,
            and other electrical engineering workflows.
          </p>
          <p>
            Contact:{' '}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
        </div>
      </section>
    )
  }

  function renderPrivacyPage() {
    return (
      <section className="tool-panel info-page" aria-labelledby="privacy-title">
        <p className="eyebrow">Privacy Policy</p>
        <h2 id="privacy-title">Privacy Policy</h2>
        <div className="info-copy">
          <p>Last updated: July 1, 2026</p>
          <p>
            EE Toolkit runs in your browser and does not require an account. Calculator
            inputs and results are processed locally in the app and are not intentionally
            collected, stored, or sold by EE Toolkit.
          </p>
          <p>
            If you contact the developer by email, your email address and message are used
            only to respond to your request. External services linked from this site, such
            as a developer support platform, may have their own privacy practices.
          </p>
          <p>
            Privacy questions can be sent to{' '}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </div>
      </section>
    )
  }

  function renderTermsPage() {
    return (
      <section className="tool-panel info-page" aria-labelledby="terms-title">
        <p className="eyebrow">Terms of Service</p>
        <h2 id="terms-title">Terms of Service</h2>
        <div className="info-copy">
          <p>Last updated: July 1, 2026</p>
          <p>
            EE Toolkit is provided as a free educational resource. You may use it for
            learning, study, and problem-solving support.
          </p>
          <ul className="info-list">
            <li>Results should be checked before use in graded, professional, or safety-critical work.</li>
            <li>The toolkit is provided as-is, without warranties or guarantees of accuracy.</li>
            <li>Features, calculators, and content may change as the project is updated.</li>
          </ul>
          <p>
            Questions about these terms can be sent to{' '}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
        </div>
      </section>
    )
  }

  function renderSupportCallout() {
    return (
      <aside className="support-callout" aria-labelledby="support-title">
        <div>
          <h2 id="support-title">Enjoying EE Toolkit?</h2>
          <p>
            If these tools have helped you with your coursework or projects, you can
            leave an optional tip to support continued development. Your support helps
            fund new calculators, bug fixes, and educational features.
          </p>
        </div>
        <a
          className="tip-button"
          href={supportDeveloperUrl}
          target="_blank"
          rel="noreferrer"
        >
          Support this project
        </a>
      </aside>
    )
  }

  function renderCurrentPage() {
    return (
      <>
        <div hidden={activePage !== 'tools'}>{renderToolsPage()}</div>
        {activePage === 'about' && renderAboutPage()}
        {activePage === 'privacy' && renderPrivacyPage()}
        {activePage === 'terms' && renderTermsPage()}
      </>
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Electrical Engineering Toolkit</p>
          <h1>EE Toolkit</h1>
          <p className="author-credit">Created by Victor Karthik</p>
        </div>
        <div className="header-actions">
          <span className="status-pill">
            {activePage === 'tools' ? activeToolMeta.shortName : activePageMeta.label}
          </span>
          <a
            className="support-button"
            href={supportDeveloperUrl}
            target="_blank"
            rel="noreferrer"
          >
            Support this project
          </a>
        </div>
      </header>

      <nav className="page-nav" aria-label="Main pages">
        {pageTabs.map((page) => (
          <button
            type="button"
            key={page.id}
            className={activePage === page.id ? 'is-active' : ''}
            aria-current={activePage === page.id ? 'page' : undefined}
            onClick={() => setActivePage(page.id)}
          >
            {page.label}
          </button>
        ))}
      </nav>

      {renderCurrentPage()}
      {renderSupportCallout()}

      <footer className="app-footer">
        <span>
          Contact:{' '}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </span>
        <div className="footer-links">
          <button type="button" onClick={() => setActivePage('privacy')}>
            Privacy Policy
          </button>
          <button type="button" onClick={() => setActivePage('terms')}>
            Terms of Service
          </button>
          <a href={supportDeveloperUrl} target="_blank" rel="noreferrer">
            Support this project
          </a>
        </div>
      </footer>
    </main>
  )
}

export default App
