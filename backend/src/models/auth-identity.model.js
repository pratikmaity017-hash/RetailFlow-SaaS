import mongoose from "mongoose";

const authIdentitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    provider: {
      type: String,
      enum: ["email", "phone", "google"],
      required: [true, "Authentication provider is required"],
    },

    // Canonical provider identifier:
    // email  -> normalized email address
    // phone  -> E.164 phone number
    // google -> verified Google OIDC subject (sub)
    providerSubject: {
      type: String,
      required: [true, "Provider subject is required"],
      trim: true,
      maxlength: 254,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },

    // Only required for email/password identities.
    passwordHash: {
      type: String,
      select: false,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },

    emailVerificationRequestVersion: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

// Normalize and validate provider-specific fields.
authIdentitySchema.pre("validate", function () {
  if (this.provider === "email") {
    if (this.email) {
      this.email = this.email.trim().toLowerCase();
    }

    if (this.providerSubject) {
      this.providerSubject = this.providerSubject.trim().toLowerCase();
    }

    if (!this.email) {
      this.invalidate("email", "Email is required for email identities");
    }

    if (this.email && this.providerSubject !== this.email) {
      this.invalidate(
        "providerSubject",
        "Email provider subject must match the normalized email",
      );
    }

    if (!this.passwordHash) {
      this.invalidate(
        "passwordHash",
        "Password hash is required for email identities",
      );
    }
  }

  if (this.provider === "phone") {
    if (this.phone) {
      this.phone = this.phone.trim();
    }

    if (!this.phone) {
      this.invalidate("phone", "Phone number is required for phone identities");
    }

    if (!/^\+[1-9]\d{7,14}$/.test(this.phone || "")) {
      this.invalidate("phone", "Phone number must use valid E.164 format");
    }

    if (this.providerSubject !== this.phone) {
      this.invalidate(
        "providerSubject",
        "Phone provider subject must match the phone number",
      );
    }
  }

  if (this.provider === "google") {
    if (!this.providerSubject?.trim()) {
      this.invalidate("providerSubject", "Google subject is required");
    }
  }
});

// One provider identity can belong to only one identity record.
authIdentitySchema.index(
  {
    provider: 1,
    providerSubject: 1,
  },
  {
    unique: true,
    name: "unique_provider_subject",
  },
);

// Efficiently find all authentication methods belonging to a User.
authIdentitySchema.index(
  {
    user: 1,
    provider: 1,
  },
  {
    name: "user_provider_lookup",
  },
);

const AuthIdentity = mongoose.model("AuthIdentity", authIdentitySchema);

export default AuthIdentity;
