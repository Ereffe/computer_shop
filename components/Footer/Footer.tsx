import './Footer.css'

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <p>
          &copy; {new Date().getFullYear()} Kacper Mirocha. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;