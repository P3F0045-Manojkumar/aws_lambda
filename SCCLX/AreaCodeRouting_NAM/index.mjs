export const handler = async (event) => {
    console.log("Event:", JSON.stringify(event));
    const callerNumber = event.Details.ContactData.CustomerEndpoint.Address || "";
    let areaCode = null;

    // Extract US area code
    if (callerNumber.startsWith("+1") && callerNumber.length >= 5) {
        areaCode = callerNumber.substring(2, 5); // e.g., "510"
    }

    // Hardcoded mapping: areaCode -> queue name
    const areaCodeToQueueMap = {
        // Region 1
        "209": "IB_NOD_NAM_Region_1",
        "279": "IB_NOD_NAM_Region_1",
        "408": "IB_NOD_NAM_Region_1",
        "415": "IB_NOD_NAM_Region_1",
        "510": "IB_NOD_NAM_Region_1",
        "530": "IB_NOD_NAM_Region_1",
        "559": "IB_NOD_NAM_Region_1",
        "650": "IB_NOD_NAM_Region_1",
        "669": "IB_NOD_NAM_Region_1",
        "707": "IB_NOD_NAM_Region_1",
        "831": "IB_NOD_NAM_Region_1",
        "916": "IB_NOD_NAM_Region_1",
        "925": "IB_NOD_NAM_Region_1",

        // Region 2
        "044": "IB_NOD_NAM_Region_2",
        "026": "IB_NOD_NAM_Region_2",
        "019": "IB_NOD_NAM_Region_2",
        "858": "IB_NOD_NAM_Region_2",

        // Region 3
        "021": "IB_NOD_NAM_Region_3",
        "033": "IB_NOD_NAM_Region_3",
        "010": "IB_NOD_NAM_Region_3",
        "032": "IB_NOD_NAM_Region_3",
        "034": "IB_NOD_NAM_Region_3",
        "024": "IB_NOD_NAM_Region_3",
        "056": "IB_NOD_NAM_Region_3",
        "020": "IB_NOD_NAM_Region_3",

        // Region 4
        "076": "IB_NOD_NAM_Region_4",
        "009": "IB_NOD_NAM_Region_4",
        "951": "IB_NOD_NAM_Region_4"
    };

    // Get the corresponding queue name
    const queueName = areaCodeToQueueMap[areaCode] || "IB_NOD_NAM_Region_5"; // default if not found

    const response= {
        areaCode,
        queueName
    };
    console.log("Response:", JSON.stringify(response));
    return response;
};
