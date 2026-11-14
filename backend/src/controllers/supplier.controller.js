import {
  createSupplier,
  listSuppliers,
  getSupplierById,
  updateSupplierById,
  updateSupplierStatus,
} from "../services/supplier.service.js";

export async function createSupplierController(req, res, next) {
  try {
    const supplier = await createSupplier({
      organizationId: req.organization.id,
      userId: req.auth.userId,
      supplierData: req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      data: {
        supplier,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listSuppliersController(req, res, next) {
  try {
    const result = await listSuppliers({
      organizationId: req.organization.id,
      query: req.validatedQuery,
    });

    return res.status(200).json({
      success: true,
      message: "Suppliers retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSupplierByIdController(req, res, next) {
  try {
    const supplier = await getSupplierById({
      organizationId: req.organization.id,
      supplierId: req.params.supplierId,
    });

    return res.status(200).json({
      success: true,
      message: "Supplier retrieved successfully",
      data: {
        supplier,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSupplierController(req, res, next) {
  try {
    const supplier = await updateSupplierById({
      organizationId: req.organization.id,
      supplierId: req.params.supplierId,
      userId: req.auth.userId,
      supplierData: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      data: { supplier },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateSupplierStatusController(req, res, next) {
  try {
    const supplier = await updateSupplierStatus({
      organizationId: req.organization.id,
      supplierId: req.params.supplierId,
      userId: req.auth.userId,
      status: req.body.status,
    });

    return res.status(200).json({
      success: true,
      message: "Supplier status updated successfully",
      data: { supplier },
    });
  } catch (error) {
    next(error);
  }
}
