// Audience list as plain typographic rows - no icons, no cards.
const USE_CASES = [
  {
    body: "SRC and departmental elections, hall week polls, class rep votes - run them all every year on one platform, with the full history kept.",
    title: "Universities and schools",
  },
  {
    body: "National, regional, and branch executive elections with constituency-scoped ballots and agents observing the count for every candidate.",
    title: "Unions and federations",
  },
  {
    body: "Annual general meetings, board seats, and constitutional referenda - with quorum-ready turnout numbers and certified outcomes.",
    title: "Associations and clubs",
  },
  {
    body: "Staff councils, committee seats, and workplace polls that need anonymity guarantees employees actually believe.",
    title: "Companies and co-ops",
  },
];

export function UseCases() {
  return (
    <section className="mx-auto mb-24 flex max-w-6xl flex-col gap-8 px-6 md:mb-32 md:px-12">
      <h2 className="text-4xl font-medium md:text-5xl">
        Built for <span className="text-muted-foreground/50">every kind of body</span>
      </h2>
      <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
        Set it up once and reuse it election after election, year after year -
        your members keep one login and the full history stays at their
        fingertips.
      </p>
      <div className="grid grid-cols-1 gap-12 sm:grid-cols-2">
        {USE_CASES.map((useCase) => (
          <div key={useCase.title}>
            <h3 className="text-2xl font-medium md:text-3xl">{useCase.title}</h3>
            <p className="mt-3 max-w-md text-lg leading-relaxed text-muted-foreground">
              {useCase.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
