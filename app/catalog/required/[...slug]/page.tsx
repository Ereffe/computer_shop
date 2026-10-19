import CatalogView from "@/components/CatalogView/CatalogView";

const RequiredCatalogPage = async ({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) => {
  const { slug } = await params;

  return <CatalogView basePath="/catalog/required" slug={slug} />;
};

export default RequiredCatalogPage;
