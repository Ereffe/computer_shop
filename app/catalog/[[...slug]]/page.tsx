import CatalogView from "@/components/CatalogView/CatalogView";

const CatalogPage = async ({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) => {
  const { slug } = await params;

  return <CatalogView basePath="/catalog" slug={slug} />;
};

export default CatalogPage;
