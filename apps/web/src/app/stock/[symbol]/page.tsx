import { StockDetail } from "@/components/detail";

export default async function Page({ params }: PageProps<"/stock/[symbol]">) {
  const { symbol } = await params;
  return <StockDetail symbol={symbol} />;
}
