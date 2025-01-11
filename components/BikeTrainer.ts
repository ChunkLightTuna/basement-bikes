/**
 * Based off FTMS_v1.0.pdf
 */

export interface BikeTrainer {
    /**
     * 4.9.1.8 Instantaneous Power
     *
     * The Instantaneous Power field may be included in the Indoor Bike Data characteristic if the device
     * supports the Power Measurement feature (see Table 4.10).
     *
     * The Instantaneous Power field represents the value of the instantaneous power measured by the Server
     */
    get instantaneous_power(): () => number

    /**
     * 4.9.1.9 Average Power
     *
     * The Average Power field may be included in the Indoor Bike Data characteristic if the device supports the
     * Power Measurement feature (see Table 4.10).
     *
     * The Average Power field represents the value of the average power measured by the Server since the
     * beginning of the training session.
     */
    get average_power(): () => number // Target Power, SINT16, in Watt with a resolution of 1 W.


    /**
     * 4.14 Supported Power Range
     *
     * The Supported Power Range characteristic shall be exposed by the Server if the Power Target Setting
     * feature is supported.
     *
     * The Supported Power Range characteristic is used to send the supported power range as well as the
     * minimum power increment supported by the Server. Included in the characteristic value are a Minimum
     * Power field, a Maximum Power field, and a Minimum Increment field as defined on the Bluetooth SIG
     * Assigned Numbers webpage [2]. Note that the Minimum Power field and the Maximum Power field
     * represent the extreme values supported by the Server and are not related to, for example, the current
     * speed of the Server.
     */
    get supported_power_range(): () => number


    /**
     * 4.16.2.6 Set Target Power Procedure
     * This procedure requires control permission in order to be executed. Refer to Section 4.16.2.1 for more
     * information on the Request Control procedure.
     * When the Set Target Power Op Code is written to the Fitness Machine Control Point and the Result Code
     * is ‘Success’, the Server shall set the target power to the value sent as a Parameter.
     * The response shall be indicated when the Set Target Power Procedure is completed using the Response
     * Code Op Code and the Request Op Code, along with the appropriate Result Code as defined in Section
     * 4.16.2.22.
     * If the operation results in an error condition where the Fitness Machine Control Point cannot be indicated
     * (e.g., the Client Characteristic Configuration descriptor is not configured for indication or if a procedure is
     * already in progress), see Section 4.16.3 for details on handling this condition.
     * @param watts Target Power, SINT16, in Watt with a resolution of 1 W
     */
    set target_power(watts: number)
}