import express from "express";
import { protect as userProtect } from "../middleware/authMiddleware.js";
import { 
  createOrder, 
  getUserOrders, 
  cancelOrder,
  getOrderById,
  getCancelOrderDetails,
  calculateOrder
} from "../controllers/orderController.js";

const router = express.Router();

router.post("/calculate", calculateOrder);
router.post("/", userProtect, createOrder);
router.get("/my-orders", userProtect, getUserOrders);
router.get("/cancel/:orderId", userProtect, getCancelOrderDetails);
router.post("/cancel/:orderId", userProtect, cancelOrder);
router.get("/:id", userProtect, getOrderById);

export default router;
