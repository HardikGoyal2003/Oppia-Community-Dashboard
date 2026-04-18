import type { ContributionPlatform } from "@/lib/auth/auth.types";

export type ContributorJourneyRichNote = {
  href: string;
  hrefLabel: string;
  prefix?: string;
  suffix?: string;
};

export type ContributorJourneyChecklistItem = {
  completionType?: "manual" | "verification";
  href?: string;
  hrefLabel?: string;
  importance: "high" | "low" | "medium";
  label: string;
  notes?:
    | string
    | ContributorJourneyRichNote
    | Array<string | ContributorJourneyRichNote>;
};

export type ContributorJourneyTask = {
  id: string;
  items: ContributorJourneyChecklistItem[];
  title: string;
};

export type ContributorJourneyContent = {
  intro: string;
  tasks: ContributorJourneyTask[];
};

const webPhaseOneItems: ContributorJourneyChecklistItem[] = [
  {
    href: "https://github.com/oppia/oppia/wiki/Oppia's-Mission",
    hrefLabel: "Docs Link",
    importance: "high",
    label: "Read about Oppia's Mission.",
  },
  {
    href: "https://github.com/oppia/oppia/",
    hrefLabel: "Repo Link",
    importance: "medium",
    label:
      "If Oppia's mission resonates with you, star this repo so you can easily find your way back and stay connected to the project.",
    notes:
      "Open the repository on GitHub and click the Star button in the top-right corner of the page.",
  },
  {
    importance: "high",
    label: "Build basic confidence with Git and GitHub.",
    notes: [
      "Git and GitHub are used for branching, merging, pulling, pushing, and committing.",
      {
        href: "https://www.gitmastery.me/",
        hrefLabel: "GitMastery",
        prefix: "Master Git easily with",
        suffix:
          "by practicing real commands through fun, game-like challenges and hands-on exercises.",
      },
      {
        href: "https://www.w3schools.com/git/default.asp?remote=github",
        hrefLabel: "Git & Github",
        prefix:
          "For a quicker reference and interactive exercises, use W3Schools'",
        suffix: "Tutorial.",
      },
    ],
  },
  {
    href: "https://github.com/oppia/oppia/discussions/16715",
    hrefLabel: "Discussion Link",
    importance: "medium",
    label: "Say hi and introduce yourself on GitHub Discussions.",
  },
  {
    importance: "high",
    label: "Refresh your HTML foundations.",
    notes: [
      {
        href: "https://www.w3schools.com/html/",
        hrefLabel: "this HTML tutorial for beginners",
        prefix: "A simple place to start is",
        suffix: ".",
      },
      {
        href: "https://developer.mozilla.org/en-US/docs/Learn",
        hrefLabel: "Mozilla's guide",
        prefix: "You can also use",
        suffix: "for a deeper learning path.",
      },
    ],
  },
  {
    importance: "high",
    label:
      "Practice CSS fundamentals so frontend issues feel less intimidating.",
    notes: [
      {
        href: "https://www.w3schools.com/css/",
        hrefLabel: "this CSS tutorial for beginners",
        prefix: "A simple place to start is",
        suffix: ".",
      },
      {
        href: "https://flexboxfroggy.com/",
        hrefLabel: "Flexbox Froggy",
        prefix: "For CSS practice, try",
        suffix: ".",
      },
    ],
  },
  {
    importance: "high",
    label: "Strengthen your JavaScript and TypeScript foundations.",
    notes: [
      "Most open issues are in the frontend, so strong JavaScript and TypeScript fundamentals will help you a lot over the long term.",
      {
        href: "https://www.jschallenger.com/",
        hrefLabel: "Javascript Challenger",
        prefix: "Use",
        suffix: "to learn & sharpen your JavaScript basics.",
      },
      {
        href: "https://www.typescriptlang.org/docs/handbook/intro.html",
        hrefLabel: "TypeScript tutorial",
        prefix: "Start with the",
        suffix: ".",
      },
    ],
  },
  {
    href: "https://goo.gl/forms/AttNH80OV0",
    hrefLabel: "CLA Form Link",
    importance: "high",
    label:
      "Please sign the CLA so that we can accept your contributions. If you're contributing as an individual, use the individual CLA.",
    notes: "If you do not sign the CLA, any PRs you open will be closed.",
  },
  {
    href: "https://goo.gl/forms/otv30JV3Ihv0dT3C3",
    hrefLabel: "Survey Form Link",
    importance: "medium",
    label:
      "Fill in the Oppia contributor survey to let us know what your interests are.",
  },
  {
    importance: "high",
    label: "Build a working understanding of Angular.",
    notes: [
      {
        href: "https://angular.dev/tutorials/learn-angular",
        hrefLabel: "official Angular docs and tutorial",
        prefix: "Go through the",
        suffix: ".",
      },
      {
        href: "https://www.youtube.com/playlist?list=PL1BztTYDF-QNlGo5-g65Xj1mINHYk_FM9",
        hrefLabel: "this youtube playlist",
        prefix: "If you prefer video lessons, you can checkout ",
        suffix: ".",
      },
    ],
  },
  {
    importance: "high",
    label:
      "If you are new to Python, build enough backend familiarity to read and understand Oppia's backend code.",
    notes: [
      "Oppia's backend is written in Python, so basic Python familiarity is useful even for many frontend contributors.",
      {
        href: "https://www.w3schools.com/python/",
        hrefLabel: "W3Schools' Python Tutorial",
        prefix: "For a quicker reference and interactive exercises, use",
        suffix: ".",
      },
    ],
  },
];

const webPhaseTwoItems: ContributorJourneyChecklistItem[] = [
  {
    href: "https://github.com/oppia/oppia/wiki/Installing-Oppia",
    hrefLabel: "Installation Docs Link",
    importance: "high",
    label: "Install Oppia following the installation instructions.",
    notes: [
      "This is the point where most of the people drop the open-source contribution journey. Installation can be challenging due differences in device environments, but remember giving up shouldn't be an option.",
      {
        href: "https://github.com/oppia/oppia/wiki/Troubleshooting",
        hrefLabel: "troubleshooting instructions",
        prefix: "If you run into problems, check the",
        suffix: "carefully before trying random fixes.",
      },
      "Try to use LLMs as little as possible during installation, because they often suggest outdated setup steps. For example, some tools may still recommend Docker-based installation even though Docker support was deprecated long ago.",
      {
        href: "https://github.com/oppia/oppia/discussions/",
        hrefLabel: "GitHub Discussions",
        prefix:
          "If the above resources don't help and you're still stuck, please check",
        suffix:
          "to see if any existing threads address the issue. If not, feel free to start a new thread explaining what you've tried and what you're seeing, so that we can try and help you!",
      },
    ],
  },
  {
    href: "https://github.com/oppia/oppia/wiki/Tips-for-common-IDEs",
    hrefLabel: "Docs Link",
    importance: "low",
    label:
      "If you want help setting up a code editor, also check out the guide to common IDEs.",
  },
  {
    href: "https://help.github.com/articles/securing-your-account-with-two-factor-authentication-2fa/",
    hrefLabel: "Docs Link",
    importance: "high",
    label: "Set up 2FA on your GitHub account.",
    notes: [
      "This is important to prevent people from impersonating you.",
      {
        href: "https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/",
        hrefLabel: "personal access token",
        prefix: "When using 2FA, you might need to create a",
        suffix: "so that you can log in from the command line.",
      },
      {
        href: "https://docs.github.com/en/github/authenticating-to-github/connecting-to-github-with-ssh",
        hrefLabel: "SSH",
        prefix: "Alternatively, you can log in using",
        suffix: ".",
      },
      "Tip: If the documentation is hard to follow, you can use an LLM (like ChatGPT) to get simpler, step-by-step instructions for this task",
    ],
  },
  {
    href: "https://github.com/oppia/oppia/subscription",
    hrefLabel: "Setting Link",
    label: "Set your GitHub notification preferences.",
    notes:
      'A common choice is "Not watching" so you notice replies that involve you without getting flooded by every repository event.',
    importance: "medium",
  },
  {
    href: "https://help.github.com/articles/caching-your-github-password-in-git/",
    hrefLabel: "Docs Link",
    label:
      "Optionally set up automatic auth so you do not need to type your username and password every time you push.",
    notes: [
      "This is not needed if you use SSH.",
      "Tip: If the documentation is hard to follow, you can use an LLM (like ChatGPT) to get simpler, step-by-step instructions for this task",
    ],
    importance: "low",
  },
];

const webPhaseThreeItems: ContributorJourneyChecklistItem[] = [
  {
    href: "https://github.com/oppia/oppia/wiki/Overview-of-the-Oppia-codebase",
    hrefLabel: "Codebase Overview",
    importance: "high",
    label: "Familiarize with Codebase",
    notes: [
      "Pay special attention to the overview of the codebase, as will help you to navigate the codebase easily",
    ],
  },
  {
    href: "https://github.com/oppia/oppia/wiki/Find-the-right-code-to-change",
    hrefLabel: "Docs Link",
    importance: "medium",
    label: "Find the right code to change",
  },
  {
    importance: "high",
    label: "Shortlist Your First Issue",
  },
  {
    completionType: "verification",
    importance: "high",
    label: "Claim Your First Issue",
    notes: [
      "Show a video of the fix working on your local machine. For user-facing changes, the video should show a URL starting with localhost:8181.",
      "Follow the same reproduction steps the issue author used, so your fix can be compared properly.",
      "If it is a bug, explain the root cause clearly and point to the relevant line of code.",
      "Explain which files you changed and what you changed.",
      {
        href: "https://github.com/orgs/oppia/projects",
        hrefLabel: "here",
        prefix:
          "@-mention the leads of the corresponding project (you can find their details",
        suffix:
          "), let them know you'd like to work on it, and mention when you expect to submit a PR by.",
      },
      "If your proof looks good and your explanation makes sense, the issue will be assigned to you. If not, the leads may ask follow-up questions about your approach or proof before assigning it.",
    ],
  },
  {
    importance: "high",
    label: "Create Your First PR",
    notes: [
      "We recommend actively moving toward a PR soon after getting assigned. Contributors may be de-assigned if the work goes stale or the PR is closed without follow-up activity.",
      {
        href: "https://github.com/oppia/oppia/wiki/Rules-for-making-PRs",
        hrefLabel: "PR instructions",
        prefix: "Please follow the",
        suffix:
          "carefully, otherwise your PR review may be delayed or your PR may be closed.",
      },
    ],
  },
  {
    completionType: "verification",
    importance: "high",
    label: "Merge Your First PR",
    notes: [
      {
        href: "https://github.com/oppia/oppia/discussions/categories/q-a-contacting-folks",
        hrefLabel: "Contacting Folks section of GitHub Discussions",
        prefix:
          "If you have not heard from a reviewer within 48 hours, leave a comment on the review thread and also add a message in the",
        suffix: ".",
      },
      {
        href: "https://github.com/oppia/oppia/discussions",
        hrefLabel: "GitHub Discussion",
        prefix: "If you run into a general problem, create a",
        suffix: "thread and explain what you have already tried.",
      },
      "It is okay to switch to a different starter issue if the first one turns out to be too difficult. You can always come back to it later.",
    ],
  },
  {
    importance: "high",
    label: "Repeat the Process and Merge Your Second PR",
    notes: [
      "Once your first PR is merged, go through the same cycle again: shortlist a new issue, investigate it properly, claim it with proof, and move it toward merge.",
      "Your second successful PR is where the workflow usually starts to feel more natural and repeatable.",
    ],
  },
];

const webPhaseFourItems: ContributorJourneyChecklistItem[] = [
  {
    href: "https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#contributor-roles",
    hrefLabel: "Contributor Roles",
    importance: "high",
    label:
      "Understand how contributor roles evolve as you keep making quality contributions.",
    notes: [
      "As a new contributor, you will only have read access to the repository, so you will need to ask other developers or Oppiabot to assign reviewers or add labels.",
      "After you merge a PR into develop, you can apply to become an Oppia collaborator. That grants repository access and lets you join a team of your choice.",
      "Collaborators receive triage access, which lets them assign reviewers and labels themselves.",
      "If you continue to make quality contributions, you may later become an organization member with write access, and eventually take on project-lead or core-maintainer responsibilities.",
      "If you ever wonder why you cannot perform a certain repository action, it may be because of your current role.",
    ],
  },
  {
    href: "https://docs.google.com/forms/d/e/1FAIpQLSdJzMdkZ7gtWQxaQ16kV4_iJh_8P3-zZwoM6jwJ6SxG6T8Xkw/viewform",
    hrefLabel: "Collaborator Interest Form",
    importance: "high",
    label: "Apply to become an Oppia collaborator after your second merged PR.",
    notes: [
      "When you have merged at least two PR, fill in the form to let the team know which team or teams you are interested in joining.",
      "To join a team, you must have completed at least one issue from that team.",
      "We will look at your contributions and may invite you to become an Oppia collaborator, which grants repository access and allows you to join a team.",
      "Please do not create your own issues and then make PRs for them expecting that to count toward onboarding.",
      "Team leads may still ask you to develop your skills on a few more substantial issues before onboarding you to the team.",
    ],
  },
  {
    href: "https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia",
    hrefLabel: "Contributing Code to Oppia",
    importance: "medium",
    label:
      "Keep contributing while you wait to hear back about the collaborator form.",
    notes: [
      "While you are waiting for a response, read the contributor guide carefully and keep making quality contributions.",
      "The roadmap does not end at the form. Consistent contributions during this waiting period still matter.",
    ],
  },
];

const webJourneyTasks: ContributorJourneyTask[] = [
  {
    id: "phase-1-understanding-oppia-and-prerequisites",
    items: webPhaseOneItems,
    title: "Phase 1: Build Your Contribution Foundations",
  },
  {
    id: "phase-2-picking-your-first-issue",
    items: webPhaseTwoItems,
    title: "Phase 2: Get Set Up for Oppia",
  },
  {
    id: "phase-3-making-your-first-contribution",
    items: webPhaseThreeItems,
    title: "Phase 3: Making Your First Contribution",
  },
  {
    id: "phase-4-growing-in-the-project",
    items: webPhaseFourItems,
    title: "Phase 4: Growing in the Project",
  },
];

const androidPhaseOneItems: ContributorJourneyChecklistItem[] = [
  {
    href: "https://github.com/oppia/oppia-android/wiki/Our-Mission",
    hrefLabel: "Docs Link",
    importance: "high",
    label: "Read about Oppia's Mission.",
  },
  {
    href: "https://github.com/oppia/oppia-android",
    hrefLabel: "Repo Link",
    importance: "medium",
    label:
      "If Oppia's mission resonates with you, star this repo so you can easily find your way back and stay connected to the project.",
    notes:
      "Open the repository on GitHub and click the Star button in the top-right corner of the page.",
  },
  {
    importance: "high",
    label: "Build basic confidence with Git and GitHub.",
    notes: [
      "Git and GitHub are used for branching, merging, pulling, pushing, and committing.",
      {
        href: "https://www.gitmastery.me/",
        hrefLabel: "GitMastery",
        prefix: "Master Git easily with",
        suffix:
          "by practicing real commands through fun, game-like challenges and hands-on exercises.",
      },
      {
        href: "https://www.w3schools.com/git/default.asp?remote=github",
        hrefLabel: "Git & Github",
        prefix:
          "For a quicker reference and interactive exercises, use W3Schools'",
        suffix: "Tutorial.",
      },
    ],
  },
  {
    href: "https://github.com/oppia/oppia-android/discussions/4788",
    hrefLabel: "Discussion Link",
    importance: "medium",
    label: "Say hi and introduce yourself on GitHub Discussions.",
  },
  {
    importance: "high",
    label: "Strengthen your Kotlin foundations.",
    notes: [
      "Most Oppia Android code is written in Kotlin, so solid Kotlin fundamentals will help you read and modify the code confidently.",
      {
        href: "https://www.udacity.com/course/kotlin-bootcamp-for-programmers--ud9011",
        hrefLabel: "Kotlin bootcamp for programmers",
        prefix: "You can learn the basics of Kotlin from Udacity --",
        suffix: "by Google.",
      },
      {
        href: "https://play.kotlinlang.org/koans/overview",
        hrefLabel: "Kotlin Koans",
        prefix: "Use",
        suffix: "for interactive Kotlin exercises.",
      },
    ],
  },
  {
    importance: "high",
    label: "Install Android Studio",
    notes: [
      {
        href: "https://developer.android.com/studio/archive",
        hrefLabel: "Android Studio Giraffe",
        prefix: "Install",
        suffix:
          "from the Android Studio archive, as that is the version we use for development.",
      },
    ],
  },
  {
    importance: "high",
    label:
      "Familiarize yourself with common Android libraries and architecture patterns.",
    notes: [
      {
        href: "https://www.udacity.com/course/kotlin-bootcamp-for-programmers--ud9011",
        hrefLabel: "Developing Android Apps with Kotlin",
        prefix:
          "Learn the basics of android to understand the project structure and the libraries that are used in most common apps from the Udacity -- ",
        suffix: "by Google.",
      },
    ],
  },
  {
    importance: "medium",
    label: "Explore advanced Android topics to deepen your understanding.",
    notes: [
      {
        href: "https://www.udacity.com/course/advanced-android-with-kotlin--ud940",
        hrefLabel: "Advanced Android with Kotlin",
        prefix:
          "For a deeper dive into Android development, including best practices and advanced topics, check out",
        suffix: "covers topics like Dependency Injection and Testing.",
      },
    ],
  },
  {
    href: "https://goo.gl/forms/AttNH80OV0",
    hrefLabel: "CLA Form Link",
    importance: "high",
    label:
      "Please sign the CLA so that we can accept your contributions. If you're contributing as an individual, use the individual CLA.",
    notes: "If you do not sign the CLA, any PRs you open will be closed.",
  },
  {
    href: "https://goo.gl/forms/otv30JV3Ihv0dT3C3",
    hrefLabel: "Survey Form Link",
    importance: "medium",
    label:
      "Fill in the Oppia contributor survey to let us know what your interests are.",
  },
  {
    importance: "high",
    label: "Build working understanding of Bazel.",
    notes: [
      "Bazel is the build system used for Oppia Android, so understanding how to build and test the app with Bazel is crucial for making contributions.",
      {
        href: "https://bazel.build/about/intro",
        hrefLabel: "Bazel Introduction",
        prefix: "Start with the official guide",
        suffix: "to understand Bazel’s core concepts.",
      },
      {
        href: "https://bazel.build/start/android-app",
        hrefLabel: "Bazel for Android",
        prefix: "Then dive into Android-specific docs",
        suffix: "to learn how to build and test apps with Bazel.",
      },
    ],
  },
];

const androidPhaseTwoItems: ContributorJourneyChecklistItem[] = [
  {
    href: "https://github.com/oppia/oppia-android/wiki/Installing-Oppia-Android",
    hrefLabel: "Installation Docs Link",
    importance: "high",
    label: "Install Oppia following the installation instructions.",
    notes: [
      "This is the point where most of the people drop the open-source contribution journey. Installation can be challenging due differences in device environments, but remember giving up shouldn't be an option.",
      {
        href: "https://github.com/oppia/oppia-android/wiki/Installing-Oppia-Android#troubleshooting-installation",
        hrefLabel: "troubleshooting instructions",
        prefix: "If you run into problems, check the",
        suffix: "carefully before trying random fixes.",
      },
      "Try to use LLMs as little as possible during installation, because they often suggest outdated setup steps. For example, some tools may still recommend Docker-based installation for web even though Docker support was deprecated long ago.",
      {
        href: "https://github.com/oppia/oppia-android/discussions/categories/q-a-installation",
        hrefLabel: "GitHub Discussions",
        prefix:
          "If the above resources don't help and you're still stuck, please check",
        suffix:
          "to see if any existing threads address the issue. If not, feel free to start a new thread explaining what you've tried and what you're seeing, so that we can try and help you!",
      },
    ],
  },
  {
    href: "https://help.github.com/articles/securing-your-account-with-two-factor-authentication-2fa/",
    hrefLabel: "Docs Link",
    importance: "high",
    label: "Set up 2FA on your GitHub account.",
    notes: [
      "This is important to prevent people from impersonating you.",
      {
        href: "https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/",
        hrefLabel: "personal access token",
        prefix: "When using 2FA, you might need to create a",
        suffix: "so that you can log in from the command line.",
      },
      {
        href: "https://docs.github.com/en/github/authenticating-to-github/connecting-to-github-with-ssh",
        hrefLabel: "SSH",
        prefix: "Alternatively, you can log in using",
        suffix: ".",
      },
      "Tip: If the documentation is hard to follow, you can use an LLM (like ChatGPT) to get simpler, step-by-step instructions for this task",
    ],
  },
  {
    href: "https://github.com/oppia/oppia-android/subscription",
    hrefLabel: "Setting Link",
    label: "Set your GitHub notification preferences.",
    notes:
      'A common choice is "Not watching" so you notice replies that involve you without getting flooded by every repository event.',
    importance: "medium",
  },
  {
    href: "https://help.github.com/articles/caching-your-github-password-in-git/",
    hrefLabel: "Docs Link",
    label:
      "Optionally set up automatic auth so you do not need to type your username and password every time you push.",
    notes: [
      "This is not needed if you use SSH.",
      "Tip: If the documentation is hard to follow, you can use an LLM (like ChatGPT) to get simpler, step-by-step instructions for this task",
    ],
    importance: "medium",
  },
];

const androidPhaseThreeItems: ContributorJourneyChecklistItem[] = [
  {
    href: "https://github.com/oppia/oppia-android/wiki/Overview-of-the-Oppia-Android-codebase-and-architecture",
    hrefLabel: "Codebase Overview",
    importance: "high",
    label: "Familiarize with Codebase",
    notes: [
      "Pay special attention to the overview of the codebase, as will help you to navigate the codebase easily",
    ],
  },
  {
    importance: "high",
    label: "Shortlist Your First Issue",
  },
  {
    completionType: "verification",
    importance: "high",
    label: "Claim Your First Issue",
    notes: [
      "Show a video of the fix working on your local Android environment. For learner-facing changes, the video should demonstrate the app running on an emulator or device.",
      "Follow the same reproduction steps the issue author used, so your fix can be compared properly.",
      "If it is a bug, explain the root cause clearly and point to the relevant line of code.",
      "Explain which files you changed and what you changed.",
      {
        href: "https://github.com/oppia/oppia-android/projects?query=is%3Aopen",
        hrefLabel: "here",
        prefix:
          "@-mention the leads of the corresponding project (you can find their details",
        suffix:
          "), let them know you'd like to work on it, and mention when you expect to submit a PR by.",
      },
      "If your proof looks good and your explanation makes sense, the issue will be assigned to you. If not, the leads may ask follow-up questions about your approach or proof before assigning it.",
    ],
  },
  {
    importance: "high",
    label: "Create Your First PR",
    notes: [
      "We recommend actively moving toward a PR soon after getting assigned. Contributors may be de-assigned if the work goes stale or the PR is closed without follow-up activity.",
      {
        href: "https://github.com/oppia/oppia-android/wiki/Guidance-on-submitting-a-PR",
        hrefLabel: "PR instructions",
        prefix: "Please follow the",
        suffix:
          "carefully, otherwise your PR review may be delayed or your PR may be closed.",
      },
    ],
  },
  {
    completionType: "verification",
    importance: "high",
    label: "Merge Your First PR",
    notes: [
      {
        href: "https://github.com/oppia/oppia-android/discussions/categories/q-a-contacting-folks",
        hrefLabel: "Contacting Folks section of GitHub Discussions",
        prefix:
          "If you have not heard from a reviewer within 48 hours, leave a comment on the review thread and also add a message in the",
        suffix: ".",
      },
      {
        href: "https://github.com/oppia/oppia-android/discussions",
        hrefLabel: "GitHub Discussion",
        prefix: "If you run into a general problem, create a",
        suffix: "thread and explain what you have already tried.",
      },
      "It is okay to switch to a different starter issue if the first one turns out to be too difficult. You can always come back to it later.",
    ],
  },
  {
    importance: "high",
    label: "Repeat the Process and Merge Your Second PR",
    notes: [
      "Once your first PR is merged, go through the same cycle again: shortlist a new issue, investigate it properly, claim it with proof, and move it toward merge.",
      "Your second successful PR is where the workflow usually starts to feel more natural and repeatable.",
    ],
  },
];

const androidPhaseFourItems: ContributorJourneyChecklistItem[] = [
  {
    href: "https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#contributor-roles",
    hrefLabel: "Contributor Roles",
    importance: "high",
    label:
      "Understand how contributor roles evolve as you keep making quality contributions.",
    notes: [
      "As a new contributor, you will only have read access to the repository, so you will need to ask other developers or Oppiabot to assign reviewers or add labels.",
      "After you merge a PR into develop, you can apply to become an Oppia collaborator. That grants repository access and lets you join a team of your choice.",
      "Collaborators receive triage access, which lets them assign reviewers and labels themselves.",
      "If you continue to make quality contributions, you may later become an organization member with write access, and eventually take on project-lead or core-maintainer responsibilities.",
      "If you ever wonder why you cannot perform a certain repository action, it may be because of your current role.",
    ],
  },
  {
    href: "https://docs.google.com/forms/d/e/1FAIpQLSes4wj7oKtiN0iyUwd-Xt_DAOr1b-MHG9_YYIavWBF4G6g8uA/viewform",
    hrefLabel: "Collaborator Interest Form",
    importance: "high",
    label: "Apply to become an Oppia collaborator after your second merged PR.",
    notes: [
      "When you have merged at least two PR, fill in the form to let the team know which team or teams you are interested in joining.",
      "To join a team, you must have completed at least one issue from that team.",
      "We will look at your contributions and may invite you to become an Oppia collaborator, which grants repository access and allows you to join a team.",
      "Please do not create your own issues and then make PRs for them expecting that to count toward onboarding.",
      "Team leads may still ask you to develop your skills on a few more substantial issues before onboarding you to the team.",
    ],
  },
  {
    href: "https://github.com/oppia/oppia-android/wiki/Contributing-to-Oppia-Android",
    hrefLabel: "Contributing Code to Oppia",
    importance: "medium",
    label:
      "Keep contributing while you wait to hear back about the collaborator form.",
    notes: [
      "While you are waiting for a response, read the contributor guide carefully and keep making quality contributions.",
    ],
  },
];

const androidJourneyTasks: ContributorJourneyTask[] = [
  {
    id: "phase-1-understanding-oppia-and-prerequisites",
    items: androidPhaseOneItems,
    title: "Phase 1: Build Your Contribution Foundations",
  },
  {
    id: "phase-2-picking-your-first-issue",
    items: androidPhaseTwoItems,
    title: "Phase 2: Get Set Up for Oppia",
  },
  {
    id: "phase-3-making-your-first-contribution",
    items: androidPhaseThreeItems,
    title: "Phase 3: Making Your First Contribution",
  },
  {
    id: "phase-4-growing-in-the-project",
    items: androidPhaseFourItems,
    title: "Phase 4: Growing in the Project",
  },
];

export const CONTRIBUTOR_JOURNEY_CONTENT: Record<
  ContributionPlatform,
  ContributorJourneyContent
> = {
  ANDROID: {
    intro:
      "A task-by-task checklist to help you get from first login to first contribution without losing momentum.",
    tasks: androidJourneyTasks,
  },
  WEB: {
    intro:
      "A task-by-task checklist to help you get from first login to first contribution without losing momentum.",
    tasks: webJourneyTasks,
  },
};
