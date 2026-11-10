import Membership from "../models/membership.model.js";

export async function getUserOrganizations({ userId }) {
  const memberships = await Membership.find({
    user: userId,
    status: "active",
  })
    .populate({
      path: "organization",
      match: { status: "active" },
      select: "_id name slug",
    })
    .sort({ createdAt: 1 })
    .lean();

  return memberships
    .filter((membership) => membership.organization)
    .map((membership) => ({
      membershipId: membership._id.toString(),
      role: membership.role,
      organization: {
        id: membership.organization._id.toString(),
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
    }));
}
