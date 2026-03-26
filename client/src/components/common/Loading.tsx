import { Loader2 } from "lucide-react";

export function Loading({ message = "Loading data..." }: { message?: string }) {
  return (
    <div className="loading-container">
      <Loader2 className="spinner" size={32} />
      <p>{message}</p>
    </div>
  );
}
