const AboutPage = () => {
  return (
    <div className="about">
      <section className="about-content">
        <h1>About Computer Shop</h1>

        <p className="about-intro">
          Computer Shop to aplikacja internetowa stworzona do prezentowania
          i przeglądania produktów komputerowych.
        </p>

        <div className="about-section">
          <h2>Technologie</h2>

          <ul>
            <li>Next.js</li>
            <li>React</li>
            <li>TypeScript</li>
            <li>CSS</li>
          </ul>
        </div>

        <div className="about-section">
          <h2>Autor</h2>

          <p>
            Projekt został wykonany przez <strong>Kacpra Mirocha</strong>
          </p>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
