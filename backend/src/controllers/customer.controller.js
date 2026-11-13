import {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deactivateCustomer,
} from "../services/customer.service.js";

export async function createCustomerController(req, res, next) {
  try {
    const customer = await createCustomer({
      organizationId: req.organization.id,
      userId: req.auth.userId,
      customerData: req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      data: {
        customer,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCustomersController(req, res, next) {
  try {
    const result = await getCustomers({
      organizationId: req.organization.id,
      role: req.membership.role,
      search: req.query.search,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Customers retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCustomerByIdController(req, res, next) {
  try {
    const customer = await getCustomerById({
      organizationId: req.organization.id,
      customerId: req.params.customerId,
    });

    return res.status(200).json({
      success: true,
      message: "Customer retrieved successfully",
      data: {
        customer,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateCustomerController(req, res, next) {
  try {
    const customer = await updateCustomer({
      organizationId: req.organization.id,
      customerId: req.params.customerId,
      userId: req.auth.userId,
      customerData: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      data: {
        customer,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function deactivateCustomerController(req, res, next) {
  try {
    const customer = await deactivateCustomer({
      organizationId: req.organization.id,
      customerId: req.params.customerId,
      userId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Customer deactivated successfully",
      data: {
        customer,
      },
    });
  } catch (error) {
    return next(error);
  }
}
