import { describeEventContract } from "../testing/contract-suite.js";
import { SessionStartedV1 } from "./session-started.js";

describeEventContract("SessionStarted", SessionStartedV1);
