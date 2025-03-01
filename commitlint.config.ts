import type { UserConfig } from "@commitlint/types";

const Configurations: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  formatter: "@commitlint/format",
};

export default Configurations;
