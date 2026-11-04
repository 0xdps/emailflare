"use client";

import AcceptInvite from "@/components/pages/AcceptInvite";
import { useParams } from "next/navigation";

export default function InvitePage() {
	const params = useParams<{ token: string }>();
	return <AcceptInvite token={params.token} />;
}
