import { useAuth } from "@portal/contract";

// Wrong useAuth() field
export const Name = () => <p>{useAuth().session?.name}</p>;
