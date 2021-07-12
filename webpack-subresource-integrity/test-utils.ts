import webpack, { Configuration, Stats, StatsError } from "webpack";

const errorFromStats = (stats: Stats | undefined): Error => {
  const errors = stats?.toJson()?.errors;
  if (!errors) {
    return new Error("No stats");
  }
  return new Error(
    "Error:" + errors.map((error: StatsError) => error.message).join(", ")
  );
};

export const runWebpack = (options: Configuration): Promise<Stats> =>
  new Promise((resolve, reject) => {
    webpack(options, (err: Error | undefined, stats: Stats | undefined) => {
      if (err) {
        reject(err);
      } else if (stats?.hasErrors() === false) {
        resolve(stats);
      } else {
        reject(errorFromStats(stats));
      }
    });
  });
