import { notFound } from "next/navigation"

/** Any unknown /business-portal/* address renders the portal's 404 page (SCR-B-047). */
export default function UnknownBusinessPage() {
  notFound()
}
