// eslint-disable-next-line
import zod from "https://cdn.jsdelivr.net/npm/zod@3.22.4/+esm";
import config from "../../config.js";

const zodValidators = {
  textOptional: zod.string().optional(),
  textRequired: zod.string().nonempty(),
  email: zod.string().email(),
  date: zod.string().refine((value) => !isNaN(Date.parse(value)), { message: "Invalid date" }),
  time: zod.string().refine((value) => !isNaN(Date.parse(`01/01/2000 ${value}`)), { message: "Invalid time" }),
  phone: zod.string().regex(/^\+?\d{1,3}[- ]?\d{3}[- ]?\d{3}[- ]?\d{4}$/, {
    message: "Invalid phone number, check if country code is provided.",
  }),
};

function validateFormData(values, validationSchema) {
  try {
    validationSchema.parse(values);
    return [true, null];
  } catch (error) {
    if (error instanceof zod.ZodError) {
      console.error("Validation errors:", error.errors);
    } else {
      console.error("Non validation error:", error);
    }
    return [false, error.errors];
  }
}

export const sendData = async (formId) => {
  if (document.querySelector('div[data-preview="true"]'))
    return alert("This feature is not available in preview mode.");

  const form = document.getElementById(formId);
  const submitButton = form.querySelectorAll("button")[0];
  const formData = new FormData(form);
  const formDataJson = Object.fromEntries(formData.entries());

  const entries = [];
  const inputs = form.querySelectorAll("input, textarea");
  inputs.forEach((input) => {
    const validator = input.getAttribute("data-validator");
    const name = input.getAttribute("name");
    entries.push([name, zodValidators[validator]]);
  });
  const selects = form.querySelectorAll("select");
  selects.forEach((select) => {
    const validator = select.getAttribute("data-validator");
    const name = select.getAttribute("name");
    entries.push([name, zodValidators[validator]]);
  });

  const validationSchema = zod.object(Object.fromEntries(entries));
  const [isValid, errors] = validateFormData(formDataJson, validationSchema);

  if (!isValid) {
    errors.forEach((error) => {
      const key = error.path[0];
      const errorSpan = document.getElementById(`${formId}-${key}-error`);
      if (errorSpan) {
        errorSpan.innerHTML = error.message;
      } else {
        const errorSpan = document.createElement("span");
        errorSpan.id = `${formId}-${key}-error`;
        errorSpan.innerHTML = error.message;
        errorSpan.style.color = "red";
        const input = form.querySelector(`[name="${key}"]`);
        input.parentNode.appendChild(errorSpan);
      }
    });
    return;
  }

  const metaTag = document.querySelector('meta[name="projectId"]');

  const resetForm = () => {
    form.reset();
  };

  const disableButton = () => {
    submitButton.disabled = true;
    submitButton.style.cursor = "not-allowed";
    submitButton.style.opacity = "0.5";
  };

  const enableButton = () => {
    submitButton.disabled = false;
    submitButton.style.cursor = "pointer";
    submitButton.style.opacity = "1";
  };

  const tableFromJson = Object.entries(formDataJson)
    .map(([key, value]) => {
      return `${key}: ${value}`;
    })
    .join("\n");

  try {
    const body = {
      subject: "New form submission",
      text: tableFromJson,
      projectId: metaTag.getAttribute("content"),
    };

    disableButton();

    await fetch(`${config.apiURL}/api/v1/flow/1111`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      credentials: "include",
    });

    const email = formDataJson.from || formDataJson.email;
    const source = formId;
    await fetch(`${config.apiURL}/api/v1/user/contact/add`, {
      method: "POST",
      body: JSON.stringify({ email, source, projectId: metaTag.getAttribute("content") }),
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      credentials: "include",
    });

    resetForm();
    enableButton();

    alert("Your message has been sent sucessfully!");
  } catch (error) {
    console.error(error);
    alert("There was an error sending your message. Please try again later.");

    resetForm();
    enableButton();
  }
};
