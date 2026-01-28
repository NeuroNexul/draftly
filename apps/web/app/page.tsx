import { Button } from "@workspace/ui/components/button";
import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-svh h-svh flex flex-col items-center justify-center">
      <h1 className="text-4xl">Markly</h1>
      <Button asChild>
        <Link href="/playground">Playground</Link>
      </Button>
    </div>
  );
}
