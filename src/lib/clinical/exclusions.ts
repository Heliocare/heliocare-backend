export type Vertical = "ED" | "WEIGHT_LOSS";

export interface ExclusionEvaluation {
    hardExclusions: string[];
    softExclusions: string[];
}

export function evaluateExclusions(vertical: Vertical, responses: any): ExclusionEvaluation {
    const hard: string[] = [];
    const soft: string[] = [];

    // Provide default empty objects natively if parts are missing during early steps
    const { personalDetails = {}, medicalHistory = {}, currentMedications = {}, biometrics = {} } = responses || {};

    if (vertical === "ED") {
        if (currentMedications.includesNitrates === true) hard.push("ED_NITRATES");
        if (medicalHistory.recentMI === true) hard.push("ED_RECENT_MI");
        if (medicalHistory.recentStroke === true) hard.push("ED_RECENT_STROKE");
        if (medicalHistory.unstableAngina === true) hard.push("ED_UNSTABLE_ANGINA");
        if (typeof personalDetails.ageYears === "number" && personalDetails.ageYears < 18) hard.push("ED_AGE_UNDER_18");
        if (personalDetails.gender && personalDetails.gender !== "MALE") hard.push("ED_NOT_MALE");
    }

    if (vertical === "WEIGHT_LOSS") {
        if (medicalHistory.mtcHistory === true) hard.push("WL_MTC_HISTORY");
        if (medicalHistory.men2 === true) hard.push("WL_MEN2");
        if (medicalHistory.type1Diabetes === true) hard.push("WL_T1D");
        if (medicalHistory.pregnantOrBreastfeed === true) hard.push("WL_PREGNANT");
        if (typeof personalDetails.ageYears === "number" && personalDetails.ageYears < 18) hard.push("WL_AGE_UNDER_18");

        if (typeof biometrics.bmi === "number" && biometrics.bmi < 27) soft.push("WL_BMI_UNDER_27");
    }

    return { hardExclusions: hard, softExclusions: soft };
}
