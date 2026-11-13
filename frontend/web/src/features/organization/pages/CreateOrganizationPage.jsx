import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/useAuth";
import {
  createOrganization,
  getBusinessCategories,
  updateOrganizationCategories,
} from "../organizationService";

import "./organization.css";

function CreateOrganizationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [categories, setCategories] = useState([]);
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [additionalCategories, setAdditionalCategories] = useState([]);

  const [createdOrganizationId, setCreatedOrganizationId] = useState("");
  const [creationNeedsRecovery, setCreationNeedsRecovery] = useState(false);

  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const response = await getBusinessCategories();

        if (isMounted) {
          setCategories(response?.data?.categories || []);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.data?.message ||
              "Unable to load business categories.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingCategories(false);
        }
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleAdditionalCategoryChange(categoryId) {
    setAdditionalCategories((previous) =>
      previous.includes(categoryId)
        ? previous.filter((id) => id !== categoryId)
        : [...previous, categoryId],
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (creationNeedsRecovery) {
      setError(
        "Organization creation may have succeeded, but its ID was not returned. Please check your dashboard before trying again.",
      );
      return;
    }

    const organizationName = name.trim();

    if (
      !createdOrganizationId &&
      (organizationName.length < 2 || organizationName.length > 150)
    ) {
      setError("Organization name must contain 2 to 150 characters.");
      return;
    }

    if (!primaryCategory) {
      setError("Please select a primary business category.");
      return;
    }

    if (additionalCategories.includes(primaryCategory)) {
      setError("Primary category cannot also be an additional category.");
      return;
    }

    let organizationWasCreated = Boolean(createdOrganizationId);

    try {
      setIsSubmitting(true);

      let organizationId = createdOrganizationId;

      // Create the organization only once.
      if (!organizationId) {
        const createResponse = await createOrganization(organizationName);

        organizationId = createResponse?.data?.organization?.id;

        if (!organizationId) {
          setCreationNeedsRecovery(true);

          throw new Error(
            "The organization creation request succeeded, but its ID was not returned. Please check your dashboard before retrying.",
          );
        }

        organizationWasCreated = true;
        setCreatedOrganizationId(organizationId);
      }

      // On retry, only update categories. Do not create another organization.
      await updateOrganizationCategories(
        organizationId,
        primaryCategory,
        additionalCategories,
      );

      navigate("/dashboard", {
        replace: true,
        state: {
          message: "Your organization has been created successfully!",
        },
      });
    } catch (err) {
      const serverMessage = err.response?.data?.message;

      if (organizationWasCreated) {
        setError(
          `Your organization has been created, but category setup could not be completed. Please retry to finish setup. ${
            serverMessage || err.message || ""
          }`,
        );
      } else {
        setError(
          serverMessage || err.message || "Unable to create your organization.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="organization-onboarding">
      <section className="organization-onboarding-card">
        <div className="organization-onboarding-heading">
          <span className="organization-eyebrow">GET STARTED</span>

          <h1>
            {createdOrganizationId
              ? "Finish organization setup"
              : "Create your organization"}
          </h1>

          <p>
            Set up your business workspace to start managing your retail
            operations with RetailFlow.
          </p>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="organizationName">Organization name</label>

            <input
              id="organizationName"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. My Retail Store"
              minLength={2}
              maxLength={150}
              required
              disabled={Boolean(createdOrganizationId)}
            />
          </div>

          <div className="organization-category-section">
            <div className="organization-category-heading">
              <label htmlFor="primaryCategory">Primary business category</label>
              <p>Choose the main type of business you operate.</p>
            </div>

            {isLoadingCategories ? (
              <p className="organization-loading">
                Loading business categories...
              </p>
            ) : categories.length === 0 ? (
              <p className="organization-loading">
                No active business categories are currently available.
              </p>
            ) : (
              <select
                id="primaryCategory"
                value={primaryCategory}
                onChange={(event) => {
                  const selectedId = event.target.value;

                  setPrimaryCategory(selectedId);
                  setAdditionalCategories((previous) =>
                    previous.filter((id) => id !== selectedId),
                  );
                }}
                required
              >
                <option value="">Select primary category</option>

                {categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="organization-category-section">
            <div className="organization-category-heading">
              <label>Additional business categories</label>
              <p>
                Select other business types if your organization operates in
                multiple categories. This is optional.
              </p>
            </div>

            {categories.length > 0 && (
              <div className="organization-category-list">
                {categories
                  .filter((category) => category._id !== primaryCategory)
                  .map((category) => (
                    <label
                      className="organization-category-option"
                      key={category._id}
                    >
                      <input
                        type="checkbox"
                        checked={additionalCategories.includes(category._id)}
                        onChange={() =>
                          handleAdditionalCategoryChange(category._id)
                        }
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
              </div>
            )}
          </div>

          <button
            className="auth-submit"
            type="submit"
            disabled={
              isSubmitting ||
              isLoadingCategories ||
              categories.length === 0 ||
              !user?.emailVerifiedAt ||
              creationNeedsRecovery
            }
          >
            {isSubmitting
              ? "Please wait..."
              : createdOrganizationId
                ? "Finish setup"
                : "Create organization"}

            {!isSubmitting && <span aria-hidden="true">→</span>}
          </button>

          {!user?.emailVerifiedAt && (
            <p className="organization-verification-note">
              Please verify your email address before creating an organization.
            </p>
          )}
        </form>
      </section>
    </main>
  );
}

export default CreateOrganizationPage;
