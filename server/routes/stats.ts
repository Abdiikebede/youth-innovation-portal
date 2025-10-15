import { RequestHandler } from "express";
import { db } from "../services/database";

export const handleGetStats: RequestHandler = async (req, res) => {
  try {
    // Get real statistics from database
    const [
      totalUsers,
      verifiedUsers,
      totalProjects,
      publishedProjects,
      totalEvents,
      upcomingEvents
    ] = await Promise.all([
      db.users.countDocuments({}),
      db.users.countDocuments({ verified: true }),
      db.projects.countDocuments({}),
      db.projects.countDocuments({ status: "published" }),
      db.events.countDocuments({}),
      db.events.countDocuments({ 
        startDate: { $gte: new Date() },
        status: "published"
      })
    ]);

    // Get sector statistics
    const sectorStats = await db.projects.aggregate([
      { $match: { status: "published" } },
      {
        $group: {
          _id: "$sector",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    // Calculate success rate based on published vs total projects
    const successRate = totalProjects > 0 ? Math.round((publishedProjects / totalProjects) * 100) : 0;

    const stats = {
      totalUsers,
      verifiedUsers,
      totalProjects,
      publishedProjects,
      totalEvents,
      upcomingEvents,
      successRate,
      sectors: sectorStats.map(sector => ({
        name: sector._id || "Other",
        count: sector.count
      }))
    };

    res.json(stats);
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
