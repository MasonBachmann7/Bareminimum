import { Brand } from "@/components/brand";
import { GrassCanvas } from "@/components/grass-canvas";
import { LandingForm } from "@/components/landing-form";

export default function LandingPage() {
  return (
    <div className="shell">
      <nav className="top">
        <Brand />
        <div className="nav-links">
          <a href="#how">how</a>
          <a href="#grass">grass</a>
        </div>
      </nav>

      <section className="hero">
        <h1>
          Your contribution graph,<br />
          on autopilot.<br />
          <span className="line2">Your side project, too.</span>
        </h1>
        <p className="lede">
          Connect your GitHub. We commit for you — quietly, realistically, every day — so your graph looks like you&apos;ve been working.
          Meanwhile, tell the bot what you&apos;ve been meaning to build. It writes <strong>100 lines a day</strong> toward that idea.
          You&apos;ll finish a side project without ever starting one.
        </p>
      </section>

      <section className="pitch-row">
        <div className="card">
          <div className="card-title">01 / the graph fills in</div>
          <p>
            Commits land at a believable cadence, with plausible messages, to a repo you control. Your profile stops reading &quot;hasn&apos;t worked since March&quot; and starts reading &quot;consistently productive.&quot; The graph won&apos;t know. Neither will anyone else.
          </p>
        </div>
        <div className="card">
          <div className="card-title">02 / the side project builds itself</div>
          <p>
            Since the bot&apos;s in there anyway, it may as well write something useful. Describe what you&apos;ve been meaning to build — a CLI, a dashboard, the game you keep talking about — and 100 lines a day land toward it. One day you&apos;ll pull the repo and realize you shipped.
          </p>
        </div>
      </section>

      <section className="cta" id="how">
        <h2>Start doing less.</h2>
        <LandingForm />
      </section>

      <section className="grass-section" id="grass">
        <h3>here is some grass for you to touch while your bot is busy at work</h3>
        <div className="grass-wrap">
          <div className="grass-caption">move your cursor. that&apos;s the ceremony.</div>
          <GrassCanvas />
        </div>
      </section>

      <footer>
        <div>© 2026 bareminimum · probably satirical · definitely functional</div>
        <div>
          built by the team behind <a href="https://bugstack.ai">bugstack</a>
        </div>
      </footer>
    </div>
  );
}
