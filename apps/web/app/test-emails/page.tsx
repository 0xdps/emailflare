import { redirect } from "next/navigation";

export default function RoutePage() {
	redirect("/inbox?folder=test");
}
