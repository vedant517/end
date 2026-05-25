import express from "express";
import { 
  getOrders, 
  updateOrder, 
  getOrderStats,
  getOrderCancellationDetails,
} from "../controllers/orderController.js";
import { createOrder, getUserOrders, cancelOrder } from "../../User/controllers/orderController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Order creation and list
router.route("/")
  .get(protect, getOrders) 
  .post(protect, createOrder);

router.get("/my-orders", protect, getUserOrders);
router.post("/cancel/:orderId", protect, authorize('admin'), cancelOrder);
router.get("/:orderId/cancellation", protect, authorize('admin'), getOrderCancellationDetails);

router.get("/stats", protect, authorize('admin'), getOrderStats);

// Admin-only write routes
router.put("/:orderId", protect, authorize('admin'), updateOrder);


export default router;
