import { createServiceError } from "../utils/service-error.util.js";
import Customer from "../models/customer.model.js";

// Escape user input before using it in a MongoDB regular expression.
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePagination(value, fallback, maximum = Infinity) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

// Create a customer inside the authenticated organization.
export async function createCustomer({ organizationId, userId, customerData }) {
  const customer = await Customer.create({
    ...customerData,
    organization: organizationId,
    createdBy: userId,
  });

  return customer;
}

// Get customers belonging only to the requested organization.
export async function getCustomers({
  organizationId,
  role,
  search,
  status,
  page,
  limit,
}) {
  const filter = {
    organization: organizationId,
  };

  // Sales Staff can only see active customers.
  if (role === "sales_staff") {
    filter.status = "active";
  } else if (["active", "inactive"].includes(status)) {
    filter.status = status;
  }

  // Search by customer name, phone, or email.
  if (typeof search === "string" && search.trim()) {
    const searchRegex = new RegExp(escapeRegex(search.trim()), "i");

    filter.$or = [
      { name: searchRegex },
      { phone: searchRegex },
      { email: searchRegex },
    ];
  }

  const currentPage = normalizePagination(page, 1);
  const pageSize = normalizePagination(limit, 20, 100);
  const skip = (currentPage - 1) * pageSize;

  const [customers, totalCustomers] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),

    Customer.countDocuments(filter),
  ]);

  return {
    customers,
    pagination: {
      currentPage,
      pageSize,
      totalCustomers,
      totalPages: Math.ceil(totalCustomers / pageSize),
      hasNextPage: skip + customers.length < totalCustomers,
      hasPreviousPage: currentPage > 1,
    },
  };
}

// Get one customer belonging to the requested organization.
export async function getCustomerById({ organizationId, customerId }) {
  const customer = await Customer.findOne({
    _id: customerId,
    organization: organizationId,
  });

  if (!customer) {
    throw createServiceError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  }

  return customer;
}

// Update customer details without replacing unspecified address fields.
export async function updateCustomer({
  organizationId,
  customerId,
  userId,
  customerData,
}) {
  const customer = await Customer.findOne({
    _id: customerId,
    organization: organizationId,
  });

  if (!customer) {
    throw createServiceError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  }

  const { address, email, ...otherFields } = customerData;

  Object.assign(customer, otherFields);

  // Allow the client to clear the email address using null.
  if (email !== undefined) {
    customer.email = email ?? "";
  }

  // Merge partial address updates instead of erasing other fields.
  if (address !== undefined) {
    customer.address = {
      ...customer.address.toObject(),
      ...address,
    };
  }

  customer.updatedBy = userId;

  await customer.save();

  return customer;
}

// Soft-deactivate a customer.
export async function deactivateCustomer({
  organizationId,
  customerId,
  userId,
}) {
  const customer = await Customer.findOneAndUpdate(
    {
      _id: customerId,
      organization: organizationId,
      status: "active",
    },
    {
      $set: {
        status: "inactive",
        updatedBy: userId,
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
    },
  );

  if (!customer) {
    throw createServiceError(
      404,
      "CUSTOMER_NOT_FOUND",
      "Active customer not found",
    );
  }

  return customer;
}
