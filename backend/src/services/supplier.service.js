import Supplier from "../models/supplier.model.js";

export async function createSupplier({ organizationId, userId, supplierData }) {
  const supplier = await Supplier.create({
    ...supplierData,
    organization: organizationId,
    createdBy: userId,
  });

  return supplier;
}

export async function listSuppliers({ organizationId, query }) {
  const { search, status, page, limit } = query;

  const filter = {
    organization: organizationId,
  };

  if (status) {
    filter.status = status;
  }

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const searchRegex = new RegExp(escapedSearch, "i");

    filter.$or = [
      { name: searchRegex },
      { contactPerson: searchRegex },
      { phone: searchRegex },
      { alternatePhone: searchRegex },
      { email: searchRegex },
      { gstin: searchRegex },
      { pan: searchRegex },
    ];
  }

  const skip = (page - 1) * limit;

  const [suppliers, total] = await Promise.all([
    Supplier.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Supplier.countDocuments(filter),
  ]);

  return {
    suppliers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getSupplierById({ organizationId, supplierId }) {
  const supplier = await Supplier.findOne({
    _id: supplierId,
    organization: organizationId,
  }).lean();

  if (!supplier) {
    const error = new Error("Supplier not found");
    error.statusCode = 404;
    error.code = "SUPPLIER_NOT_FOUND";
    throw error;
  }

  return supplier;
}

export async function updateSupplierById({
  organizationId,
  supplierId,
  userId,
  supplierData,
}) {
  const supplier = await Supplier.findOne({
    _id: supplierId,
    organization: organizationId,
  });

  if (!supplier) {
    const error = new Error("Supplier not found");
    error.statusCode = 404;
    error.code = "SUPPLIER_NOT_FOUND";
    throw error;
  }

  Object.assign(supplier, supplierData);

  supplier.updatedBy = userId;

  await supplier.save();

  return supplier;
}

export async function updateSupplierStatus({
  organizationId,
  supplierId,
  userId,
  status,
}) {
  const supplier = await Supplier.findOne({
    _id: supplierId,
    organization: organizationId,
  });

  if (!supplier) {
    const error = new Error("Supplier not found");
    error.statusCode = 404;
    error.code = "SUPPLIER_NOT_FOUND";
    throw error;
  }

  supplier.status = status;
  supplier.updatedBy = userId;

  await supplier.save();

  return supplier;
}
