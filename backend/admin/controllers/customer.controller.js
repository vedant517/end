import Order from "../models/Order.js";
import mongoose from "mongoose";

// ✅ 1. CUSTOMER DASHBOARD STATS
export const getCustomerStats = async (req, res) => {
  try {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    // 🧑 Total Customers
    const totalCustomers = await Order.aggregate([
      { $group: { _id: "$user" } },
      { $count: "total" }
    ]);

    // 🆕 New Customers
    const newCustomers = await Order.aggregate([
      { $match: { createdAt: { $gte: lastWeek } } },
      { $group: { _id: "$user" } },
      { $count: "total" }
    ]);

    // 🔁 Repeat Customers
    const repeatCustomers = await Order.aggregate([
      {
        $group: {
          _id: "$user",
          orderCount: { $sum: 1 }
        }
      },
      { $match: { orderCount: { $gt: 1 } } },
      { $count: "total" }
    ]);

    // 📈 Weekly Growth (Unique active customers per day for the last 7 days)
    const weeklyGrowth = await Order.aggregate([
      { $match: { createdAt: { $gte: lastWeek } } },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: "$createdAt" },
            user: "$user"
          }
        }
      },
      {
        $group: {
          _id: "$_id.dayOfWeek",
          count: { $sum: 1 }
        }
      }
    ]);

    const dayMap = { 1: "Sun", 2: "Mon", 3: "Tue", 4: "Wed", 5: "Thu", 6: "Fri", 7: "Sat" };
    const formattedWeeklyGrowth = weeklyGrowth.map(item => ({
      day: dayMap[item._id],
      count: item.count
    }));

    res.json({
      success: true,
      totalCustomers: totalCustomers[0]?.total || 0,
      newCustomers: newCustomers[0]?.total || 0,
      repeatCustomers: repeatCustomers[0]?.total || 0,
      weeklyGrowth: formattedWeeklyGrowth
    });


  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// ✅ 2. CUSTOMER TABLE (with pagination + search)
export const getAllCustomers = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "" } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const skip = (page - 1) * limit;

    const customers = await Order.aggregate([
      {
        $group: {
          _id: "$user",
          orderCount: { $sum: 1 },
          totalSpend: { $sum: "$totalPrice" },
          lastOrderDate: { $max: "$createdAt" }
        }
      },
      // Lookup user details
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          name: "$userDetails.name",
          email: "$userDetails.email"
        }
      },
      // 🔍 Search filter
      {
        $match: search 
          ? { name: { $regex: search, $options: "i" } }
          : {}
      },

      // ⭐ Status Logic
      {
        $addFields: {
          status: {
            $cond: [
              { $gte: ["$totalSpend", 4000] },
              "VIP",
              {
                $cond: [
                  { $gte: ["$orderCount", 2] },
                  "Active",
                  "Inactive"
                ]
              }
            ]
          }
        }
      },

      { $sort: { totalSpend: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    // 🔢 Total count for pagination
    const totalCountResult = await Order.aggregate([
      { $group: { _id: "$user" } },
      { $count: "total" }
    ]);

    res.json({
      success: true,
      data: customers,
      pagination: {
        total: totalCountResult[0]?.total || 0,
        page,
        pages: Math.ceil((totalCountResult[0]?.total || 0) / limit)
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// ✅ 3. SINGLE CUSTOMER DETAILS
export const getCustomerById = async (req, res) => {
  try {
    const { userId } = req.params;

    const customer = await Order.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },

      {
        $group: {
          _id: "$user",
          orderCount: { $sum: 1 },
          totalSpend: { $sum: "$totalPrice" },
          orders: {
            $push: {
              orderId: "$orderId",
              amount: "$totalPrice",
              status: "$status",
              date: "$createdAt"
            }
          }
        }
      },
      // Lookup user details
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      { $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          name: "$userDetails.name",
          email: "$userDetails.email"
        }
      }
    ]);

    if (!customer.length) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json({
      success: true,
      data: customer[0]
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};