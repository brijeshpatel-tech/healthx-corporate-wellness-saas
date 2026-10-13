import { Ban, CheckCircle2, Clock, PackageCheck, PackageOpen, ThumbsUp, Truck, XCircle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { OrderAction } from "@/lib/api/business/orders"
import type { OrderStatus, RewardDelivery } from "@/lib/types"

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_approval: "Pending approval",
  approved: "Approved",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

export const ORDER_STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  pending_approval: Clock,
  approved: ThumbsUp,
  processing: PackageOpen,
  shipped: Truck,
  delivered: PackageCheck,
  rejected: XCircle,
  cancelled: Ban,
}

export const ORDER_TABS: (OrderStatus | "all")[] = ["all", "pending_approval", "approved", "processing", "shipped", "delivered", "rejected", "cancelled"]

export const ACTION_META: Record<OrderAction, { label: string; title: string; icon: LucideIcon; destructive?: boolean; hint: string }> = {
  approve: { label: "Approve", title: "Approve this order?", icon: CheckCircle2, hint: "The employee is notified and the order moves on to fulfilment." },
  reject: { label: "Reject", title: "Reject this order?", icon: XCircle, destructive: true, hint: "The points are refunded to the employee straight away." },
  process: { label: "Mark processing", title: "Mark as processing?", icon: PackageOpen, hint: "Let the employee know their reward is being prepared." },
  ship: { label: "Mark shipped", title: "Mark as shipped", icon: Truck, hint: "Add the courier tracking number so the employee can follow the parcel." },
  deliver: { label: "Mark delivered", title: "Mark as delivered", icon: PackageCheck, hint: "Completes the order and notifies the employee." },
  cancel: { label: "Cancel & refund", title: "Cancel this order and refund the points?", icon: Ban, destructive: true, hint: "The points are refunded and limited stock is put back." },
}

/** The normal path an order takes for a delivery method (used for upcoming steps in the timeline). */
export function orderFlow(delivery: RewardDelivery): OrderStatus[] {
  return delivery === "physical" ? ["pending_approval", "approved", "processing", "shipped", "delivered"] : ["pending_approval", "approved", "processing", "delivered"]
}

/** What the admin should do next, in plain words. */
export function nextStepHint(status: OrderStatus, delivery: RewardDelivery): string {
  switch (status) {
    case "pending_approval":
      return "This order is waiting for your approval. Approve it to start fulfilment, or reject it to refund the points."
    case "approved":
      return delivery === "physical" ? "Prepare the item, then mark the order as processing." : "Start fulfilment, or mark it delivered once the employee has the reward."
    case "processing":
      return delivery === "physical"
        ? "Ship the item and add the tracking number — or mark it delivered if it was handed over at the office."
        : delivery === "digital_voucher"
          ? "Mark it delivered with the voucher code — the employee sees the code in My orders."
          : "Mark it delivered once the employee has received the reward."
    case "shipped":
      return "Mark the order delivered once the parcel has arrived."
    case "delivered":
      return "This order is complete. No further action is needed."
    case "rejected":
      return "This order was rejected and the points were refunded."
    case "cancelled":
      return "This order was cancelled and the points were refunded."
  }
}
