import mongoose from "mongoose";
import Supplier from "../models/supplier.model.js";
import { withSubscriptionLimit } from "./subscription-limit.service.js";
import { createAuditLog } from "./audit-log.service.js";

export async function createSupplier({ organizationId, userId, supplierData }) {
  return withSubscriptionLimit({
    organizationId,
    resource: "suppliers",

    operation: async (session) => {
      const [supplier] = await Supplier.create(
        [
          {
            ...supplierData,
            organization: organizationId,
            createdBy: userId,
          },
        ],
        { session },
      );

      await createAuditLog({
        organizationId,
        actorId: userId,
        action: "supplier.created",
        resourceType: "supplier",
        resourceId: supplier._id,
        description: "Supplier created successfully",
        metadata: {
          name: supplier.name,
          status: supplier.status,
        },
        session,
      });

      return supplier;
    },
  });
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
  const session = await mongoose.startSession();
  let updatedSupplier;

  try {
    await session.withTransaction(async () => {
      const supplier = await Supplier.findOne({
        _id: supplierId,
        organization: organizationId,
      }).session(session);

      if (!supplier) {
        const error = new Error("Supplier not found");
        error.statusCode = 404;
        error.code = "SUPPLIER_NOT_FOUND";
        throw error;
      }

      Object.assign(supplier, supplierData);
      supplier.updatedBy = userId;

      await supplier.save({ session });

      await createAuditLog({
        organizationId,
        actorId: userId,
        action: "supplier.updated",
        resourceType: "supplier",
        resourceId: supplier._id,
        description: "Supplier updated successfully",
        metadata: {
          name: supplier.name,
          status: supplier.status,
        },
        session,
      });

      updatedSupplier = supplier;
    });

    return updatedSupplier;
  } finally {
    await session.endSession();
  }
}
export async function updateSupplierStatus({
  organizationId,
  supplierId,
  userId,
  status,
}) {
  const session = await mongoose.startSession();
  let updatedSupplier;

  try {
    await session.withTransaction(async () => {
      const supplier = await Supplier.findOne({
        _id: supplierId,
        organization: organizationId,
      }).session(session);

      if (!supplier) {
        const error = new Error("Supplier not found");
        error.statusCode = 404;
        error.code = "SUPPLIER_NOT_FOUND";
        throw error;
      }

      const previousStatus = supplier.status;

      supplier.status = status;
      supplier.updatedBy = userId;

      await supplier.save({ session });

      await createAuditLog({
        organizationId,
        actorId: userId,
        action: "supplier.status_changed",
        resourceType: "supplier",
        resourceId: supplier._id,
        description: "Supplier status changed successfully",
        metadata: {
          name: supplier.name,
          previousStatus,
          newStatus: supplier.status,
        },
        session,
      });

      updatedSupplier = supplier;
    });

    return updatedSupplier;
  } finally {
    await session.endSession();
  }
}
