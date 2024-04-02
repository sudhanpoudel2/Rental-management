import otpGenerator from "otp-generator";

const generateOTP = () => {
  const OTP = otpGenerator.generate(4, {
    upperCaseAlphabets: false,
    specialChars: false,
  });
};

export default generateOTP;
