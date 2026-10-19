const ProductListLayout = ({
  children,
  featured,
  modal,
}: Readonly<{
  children: React.ReactNode;
  featured: React.ReactNode;
  modal: React.ReactNode;
}>) => {
  return (
    <div className="catalog-layout">
      <div className="catalog-main">{children}</div>

      {featured}
      {modal}
    </div>
  );
};

export default ProductListLayout;
