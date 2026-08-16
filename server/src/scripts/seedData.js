/**
 * Seed content for The Little Blooming Farm.
 *
 * This is real editorial copy, not filler — the site is a story first, so the
 * database ships with the story already in it. Everything here is editable
 * from /admin without a redeploy.
 */

export const properties = [
  {
    slug: 'vicky',
    name: 'Vicky',
    tagline: 'The Victorian house, the long table, the whole family under one roof.',
    shortDescription:
      'Four bedrooms, a kitchen built for slow mornings, and a porch that runs the length of the house. Sleeps eight.',
    description: `Vicky is the Victorian house, sitting at the top of the property and facing west, so the last hour of light comes through the kitchen and lands on the long table. That table is the point of the house. Most of what happens here happens around it.

There are four bedrooms — two upstairs under the eaves, two on the ground floor with doors to the garden. The kitchen is stocked properly: real knives, a heavy pot, enough bowls for everyone at once. There is a fireplace that draws well and a stack of dry oak beside it.

Outside, a covered porch runs the length of the house. The pool and spa are a short walk down through the lavender. The chickens will find you before you find them.

It is a house that asks very little of you. That is the whole idea.`,
    maxGuests: 8,
    bedrooms: 4,
    bathrooms: 3,
    beds: 6,
    basePriceCents: 95000,
    cleaningFeeCents: 35000,
    minNights: 2,
    maxNights: 30,
    checkInTime: '4:00 PM',
    checkOutTime: '11:00 AM',
    amenities: [
      'Full kitchen',
      'Wood-burning fireplace',
      'Heated pool',
      'Spa',
      'Outdoor pizza oven',
      'Fire pit',
      'Covered porch',
      'Washer & dryer',
      'Fast wifi',
      'Air conditioning',
      'Pack-n-play & high chair',
      'Outdoor shower',
      'Barbecue',
      'Farm access',
      'Free parking',
    ],
    houseRules: [
      'No smoking anywhere on the property.',
      'Quiet after 10pm — the animals keep early hours and so do we.',
      'Children are welcome everywhere. Please keep them with you around the pool.',
      'Please close gates behind you.',
      'Dogs by prior arrangement only — we have birds at large.',
    ],
    cancellationPolicy:
      'Free cancellation up to 30 days before check-in for a full refund. Cancellations between 7 and 30 days before arrival are refunded 50%. Within 7 days of arrival the booking is non-refundable. If you need to move your dates, write to us — we will always try.',
    displayOrder: 0,
    depositPercent: 100,
    depositOptions: [25, 50, 75],
    balanceDueDays: 30,
    arrivalInfoReleaseDays: 7,
    address: 'Roblar Avenue, Santa Ynez, CA 93460',
    rentalAgreement: {
      version: 1,
      title: 'Rental Agreement — Vicky',
      requireAcceptance: true,
      body: `SHORT-TERM RENTAL AGREEMENT

This agreement is between The Little Blooming Farm ("the Owner") and the guest named on the booking ("the Guest"). It takes effect when the Guest accepts it and applies for the dates shown on the booking.

1. THE STAY
The Guest may occupy the home shown on the booking for the dates shown, with no more than the maximum number of guests stated. Anyone not named on the booking is a visitor, not a guest, and may not stay overnight without the Owner's agreement in writing.

2. PAYMENT
Where a deposit has been taken, the balance is due by the date shown on the booking and in the Guest's booking page. Access details are released once the balance is settled. Unpaid balances may result in the booking being cancelled under clause 5.

3. THE PROPERTY IS A WORKING FARM
This is not a hotel. There are animals, uneven ground, an unfenced pool, farm equipment, and a seasonal creek. The Guest accepts that they and their party enter and use the property, its grounds, its pool and spa, and interact with the animals entirely at their own risk, and agrees to supervise children at all times. If anyone in the party cannot swim, the Guest must tell the Owner before arrival so the temporary pool fence can be fitted.

4. CARE OF THE PROPERTY
The Guest agrees to leave the property as they found it, to report any breakage or damage promptly, and to accept responsibility for the cost of repair or replacement of anything damaged beyond fair wear and tear during the stay. Gates are to be closed. Smoking is not permitted anywhere on the property, indoors or out, and a breach of this term may incur a cleaning charge.

5. CANCELLATION
Cancellation by the Guest is governed by the cancellation policy shown on the booking, which forms part of this agreement. The Owner may cancel in the event of damage to the property, a safety issue, or a material breach of this agreement, and will refund amounts paid for nights not taken.

6. QUIET ENJOYMENT
The valley is quiet and the neighbours are close. Amplified music outdoors after 10pm, and events or parties of any kind, require the Owner's prior written agreement.

7. PETS
Dogs are permitted only by prior arrangement, because birds roam freely on the property.

8. LIABILITY
Nothing in this agreement excludes liability for death or personal injury caused by the Owner's negligence, or any other liability which cannot lawfully be excluded. Subject to that, the Owner is not liable for loss or damage to the Guest's property, or for interruptions to utilities, wifi or services outside the Owner's reasonable control.

9. LAW
This agreement is governed by the laws of the State of California.

By typing their name, the Guest confirms they have read and accept this agreement.`,
    },
    arrivalInfo: {
      gateCode: '',
      doorCode: '',
      wifiNetwork: 'BloomingFarm',
      wifiPassword: '',
      directions:
        'From Highway 154, turn onto Roblar Avenue and continue for about two miles. The entrance is on the right, marked by two olive trees and a green gate. The drive is gravel and unlit — take it slowly after dark, and watch for chickens.',
      parking: 'Park anywhere on the gravel apron in front of the barn. Do not block the barn doors.',
      checkInInstructions:
        'Check-in is any time after 4pm. Use the gate code at the keypad, then the door code on the front door. Cowboy will meet you at the gate and will expect to be acknowledged.',
      checkOutInstructions:
        'Leave by 11am. Strip nothing, wash nothing — just load the dishwasher, close the windows, and pull the gate to behind you.',
      emergencyContact: '',
      houseManual: [
        {
          title: 'The animals',
          body: 'Grain for the alpacas and goats is in the bin by the paddock gate; the scoop lives inside it. Feed them whatever you like in the morning — they are not on a diet. The chickens feed themselves. Please do not feed the peacocks; it encourages them onto the porch.',
        },
        {
          title: 'Eggs',
          body: 'The nest boxes are along the back wall of the coop and the basket hangs by the door. Collect whatever is there — it is yours. If a hen is sitting, she will grumble but she will not mind.',
        },
        {
          title: 'The pool and spa',
          body: 'Both are heated April to October. The spa control is on the wall inside the pool gate. There is no lifeguard and the pool is not fenced unless you asked us to fit the temporary fence.',
        },
        {
          title: 'The pizza oven',
          body: 'Light it two hours before you want to cook — it takes that long to come up to heat. Dough recipe is taped inside the cupboard door. The first pizza always goes wrong; plan for it.',
        },
        {
          title: 'Firewood',
          body: 'Stacked behind the barn and properly dry. Use as much as you like. Kindling is in the crate.',
        },
        {
          title: 'Rubbish',
          body: 'Bins are behind the barn. Collection is Tuesday morning — if you are here on a Monday night, please wheel them to the end of the drive.',
        },
        {
          title: 'If something breaks',
          body: 'Call or message us. Nothing here is precious and we would much rather know than find out later.',
        },
      ],
    },
    photos: [
      { url: '/media/stay/home-01.jpg', alt: 'The covered porch running the length of Vicky', order: 0 },
      { url: '/media/stay/home-02.jpg', alt: 'The long kitchen table set for dinner', order: 1 },
      { url: '/media/stay/home-03.jpg', alt: 'An upstairs bedroom under the eaves', order: 2 },
      { url: '/media/stay/home-04.jpg', alt: 'The covered porch looking west', order: 3 },
    ],
  },
  {
    slug: 'the-barn',
    name: 'The Barn',
    tagline: 'A hundred-year-old barn, quiet and entirely your own.',
    shortDescription:
      'The hundred-year-old barn house at the edge of the garden. For couples, or for the half of the family that wants its own door.',
    description: `The Barn is the oldest building on the property — a hundred-year-old barn, kept as a barn and made to live in. A kitchen that does everything you need it to and nothing you don't.

It sits low at the edge of the kitchen garden, which means you can pick your own breakfast in your slippers. There is a private patio with a table and chairs, angled at the oaks, and it gets the morning sun.

People book it for two and stay quiet the entire time. People also book it alongside Vicky when the family is large and someone wants their own front door. Both are right.`,
    // TODO: confirm with the owner. Sleeps six is from the revised copy; the room
    // and bed counts below are a coherent guess, not something they told us.
    maxGuests: 6,
    bedrooms: 3,
    bathrooms: 1,
    beds: 3,
    basePriceCents: 47500,
    cleaningFeeCents: 20000,
    minNights: 2,
    maxNights: 30,
    checkInTime: '4:00 PM',
    checkOutTime: '11:00 AM',
    amenities: [
      'Kitchenette',
      'Private patio',
      'Garden access',
      'Shared pool & spa',
      'Fire pit',
      'Washer & dryer',
      'Fast wifi',
      'Air conditioning',
      'Farm access',
      'Free parking',
    ],
    houseRules: [
      'No smoking anywhere on the property.',
      'Quiet after 10pm.',
      'Please close gates behind you.',
      'Dogs by prior arrangement only.',
    ],
    cancellationPolicy:
      'Free cancellation up to 30 days before check-in for a full refund. Cancellations between 7 and 30 days before arrival are refunded 50%. Within 7 days of arrival the booking is non-refundable. If you need to move your dates, write to us — we will always try.',
    displayOrder: 1,
    depositPercent: 100,
    depositOptions: [25, 50, 75],
    balanceDueDays: 30,
    arrivalInfoReleaseDays: 7,
    address: 'Roblar Avenue, Santa Ynez, CA 93460',
    rentalAgreement: {
      version: 1,
      title: 'Rental Agreement — The Barn',
      requireAcceptance: true,
      body: `SHORT-TERM RENTAL AGREEMENT

This agreement is between The Little Blooming Farm ("the Owner") and the guest named on the booking ("the Guest"). It takes effect when the Guest accepts it and applies for the dates shown on the booking.

1. THE STAY
The Guest may occupy the home shown on the booking for the dates shown, with no more than the maximum number of guests stated. Anyone not named on the booking is a visitor, not a guest, and may not stay overnight without the Owner's agreement in writing.

2. PAYMENT
Where a deposit has been taken, the balance is due by the date shown on the booking and in the Guest's booking page. Access details are released once the balance is settled. Unpaid balances may result in the booking being cancelled under clause 5.

3. THE PROPERTY IS A WORKING FARM
This is not a hotel. There are animals, uneven ground, an unfenced pool, farm equipment, and a seasonal creek. The Guest accepts that they and their party enter and use the property, its grounds, its pool and spa, and interact with the animals entirely at their own risk, and agrees to supervise children at all times. If anyone in the party cannot swim, the Guest must tell the Owner before arrival so the temporary pool fence can be fitted.

4. CARE OF THE PROPERTY
The Guest agrees to leave the property as they found it, to report any breakage or damage promptly, and to accept responsibility for the cost of repair or replacement of anything damaged beyond fair wear and tear during the stay. Gates are to be closed. Smoking is not permitted anywhere on the property, indoors or out, and a breach of this term may incur a cleaning charge.

5. CANCELLATION
Cancellation by the Guest is governed by the cancellation policy shown on the booking, which forms part of this agreement. The Owner may cancel in the event of damage to the property, a safety issue, or a material breach of this agreement, and will refund amounts paid for nights not taken.

6. QUIET ENJOYMENT
The valley is quiet and the neighbours are close. Amplified music outdoors after 10pm, and events or parties of any kind, require the Owner's prior written agreement.

7. PETS
Dogs are permitted only by prior arrangement, because birds roam freely on the property.

8. LIABILITY
Nothing in this agreement excludes liability for death or personal injury caused by the Owner's negligence, or any other liability which cannot lawfully be excluded. Subject to that, the Owner is not liable for loss or damage to the Guest's property, or for interruptions to utilities, wifi or services outside the Owner's reasonable control.

9. LAW
This agreement is governed by the laws of the State of California.

By typing their name, the Guest confirms they have read and accept this agreement.`,
    },
    arrivalInfo: {
      gateCode: '',
      doorCode: '',
      wifiNetwork: 'BloomingFarm',
      wifiPassword: '',
      directions:
        'From Highway 154, turn onto Roblar Avenue and continue for about two miles. The entrance is on the right, marked by two olive trees and a green gate. Follow the drive past the main house and bear left at the olive tree; the Guest House is the low building at the edge of the kitchen garden.',
      parking: 'There is a space beside the Guest House itself. Park there rather than on the main apron.',
      checkInInstructions:
        'Check-in is any time after 4pm. Use the gate code at the keypad, then the door code on the blue door.',
      checkOutInstructions: 'Leave by 11am. Load the dishwasher, close the windows, pull the gate to behind you.',
      emergencyContact: '',
      houseManual: [
        {
          title: 'The kitchen garden',
          body: 'It is two steps from your door and you are welcome to pick from it. Scissors hang by the gate. Take what you will actually cook.',
        },
        {
          title: 'The animals',
          body: 'Grain for the alpacas and goats is in the bin by the paddock gate. The chickens will find you long before you find them.',
        },
        {
          title: 'The pool and spa',
          body: 'Shared with the main house and heated April to October. Please use them freely.',
        },
        {
          title: 'If something breaks',
          body: 'Call or message us. We would much rather know than find out later.',
        },
      ],
    },
    photos: [
      { url: '/media/stay/guest-01.jpg', alt: 'The Barn porch, looking out over the valley', order: 0 },
      { url: '/media/stay/guest-02.jpg', alt: 'The private patio in morning light', order: 1 },
      { url: '/media/stay/guest-03.jpg', alt: 'The bedroom, with windows onto the oaks', order: 2 },
    ],
  },
];

export const animals = [
  {
    slug: 'cowboy',
    name: 'Cowboy',
    species: 'Australian Shepherd',
    title: 'Head of arrivals',
    bio: `Cowboy hears your car before you turn off the road, and he will be waiting where the gravel starts. He has decided that greeting people is his job and he has never once called in sick.

He is thirteen now and moves like it, but he still walks the fence line every morning and still believes the peacocks are up to something. He is gentle with children to a degree that surprises people — he will lie down and let a toddler use him as furniture for as long as the toddler requires.

If he follows you back to the house and lies across your doorway, that is the highest compliment available on this farm.`,
    funFacts: [
      'Knows the sound of the pantry door from anywhere on the property.',
      'Has never caught a peacock. Has never stopped trying.',
      'Sleeps in the shade of the olive tree between 1 and 3pm, without fail.',
    ],
    photo: { url: '/media/animals/cowboy.jpeg', alt: 'Cowboy the Australian Shepherd on the gravel drive' },
    order: 0,
  },
  {
    slug: 'the-alpacas',
    name: 'The Alpacas',
    species: 'Huacaya alpacas',
    title: 'Ridiculous, dignified',
    // TODO: owner to confirm names. The revised copy says six alpacas; only four
    // were ever named in this placeholder text.
    bio: `There are six of them, including Juniper, Basil, Pockets, and a large cream-coloured one the children named Meatball, which stuck.

Alpacas are cautious animals with excellent manners. They will not take food from your hand unless they have decided about you first, which usually takes about four minutes and a lot of staring. Hold your palm flat, stay still, and let them come. They always come.

They hum. Not loudly — a soft, questioning sound, mostly to each other. Once you have heard it you will start listening for it.`,
    funFacts: [
      'Meatball is the largest and the most suspicious.',
      'They all use the same communal dung pile, which is either very tidy or very strange.',
      'Their fleece is sheared each spring and spun locally.',
    ],
    photo: { url: '/media/animals/alpacas.jpg', alt: 'Alpacas at the fence line in morning light' },
    order: 1,
  },
  {
    slug: 'the-goats',
    name: 'The Goats',
    species: 'Nigerian Dwarf goats',
    title: 'The morning shift',
    bio: `Four Nigerian dwarf goats — small, loud, and entirely without shame. They are the reason children wake up early here.

They come to the gate at around seven, complaining, and they will keep complaining until someone arrives with the grain scoop. Once fed, they become charming — they will climb anything, including you, and they will headbutt each other over a rock they have all agreed is important.

They are also excellent for the nervous child. A goat is small enough not to frighten anyone and busy enough not to stare.`,
    funFacts: [
      'Their pupils are rectangular, which is worth looking at closely at least once.',
      'They will eat a hat. Any hat. Please hold on to your hat.',
      'The smallest one, Fig, is the boss of all of them.',
    ],
    photo: { url: '/media/animals/goats.jpg', alt: 'Nigerian dwarf goats on a rock in the paddock' },
    order: 2,
  },
  {
    slug: 'the-chickens',
    name: 'The Chickens',
    species: 'Mixed heritage flock',
    title: 'Breakfast, self-delivering',
    bio: `Sixteen hens and a rooster called The Colonel who is convinced the sun requires his help.

The flock free-ranges across the orchard all day, which means you will meet them constantly and in unexpected places. They are used to people and mildly bored by them. Walk through them and they will part around you like water.

The eggs are collected in the morning and are yours. Blue-green ones from the Ameraucanas, deep brown from the Marans, and the pale ones from whoever is feeling productive.`,
    funFacts: [
      'The Colonel starts at 4:40am in summer. We are sorry, and we are not sorry.',
      'A warm egg straight from the nest box is the single most popular thing on this farm with visiting children.',
      'They will follow a bucket anywhere.',
    ],
    photo: { url: '/media/animals/chickens.jpg', alt: 'Hens scratching through the orchard grass' },
    order: 3,
  },
  {
    slug: 'the-ducks',
    name: 'The Ducks',
    species: 'Indian Runner & Pekin ducks',
    title: 'The committee',
    bio: `The runners move as a single nervous organism, standing bolt upright, hurrying everywhere in a group as if late for something. The Pekins are the opposite: broad, unbothered, and permanently damp.

They live around the lower pond and spend the day patrolling the garden beds for slugs, which is the reason they are here and the reason the lettuces survive.

At dusk they put themselves to bed without being asked, which is more than can be said for anyone else on this property.`,
    funFacts: [
      'Indian Runners cannot really fly, which they seem to resent.',
      'They eat the slugs so we do not have to use anything on the vegetables.',
      'Duck eggs make the best cake you will ever have. Ask and we will leave some out.',
    ],
    photo: { url: '/media/animals/ducks.jpg', alt: 'Indian runner ducks crossing the path in a line' },
    order: 4,
  },
  {
    slug: 'the-peacocks',
    name: 'The Peacocks',
    species: 'Indian peafowl',
    title: 'Uninvited, unbothered, unmatched',
    bio: `Nobody bought the peacocks. They arrived from somewhere down the valley about nine years ago, looked around, and stayed.

There are three: two peahens and a male the children call Elvis, who displays at his own reflection in the truck window most afternoons in spring. When he opens, everything stops. It is genuinely difficult to keep talking.

Fair warning: they roost in the oaks and they call at night. It is a strange, wild, carrying sound — a little like someone shouting for help a long way off. By your second night you will not notice it. By your third you will like it.`,
    funFacts: [
      'Elvis has been in a nine-year dispute with his own reflection. Neither side has conceded.',
      'A dropped tail feather is fair game — take it home.',
      'They eat scorpions and small snakes, which we consider more than fair rent.',
    ],
    photo: { url: '/media/animals/peacocks.jpg', alt: 'A peacock displaying beneath the oaks' },
    order: 5,
  },
];

export const experiences = [
  {
    slug: 'meet-the-alpacas',
    title: 'Meet the alpacas before breakfast',
    category: 'animals',
    season: 'Year-round',
    duration: '20 minutes, or an hour',
    shortDescription: 'Flat palm, hold still, and wait for them to decide about you.',
    description:
      'The grain bin is by the paddock gate and the scoop lives inside it. Hold your hand flat and low and let them come to you — alpacas do not snatch. The first one to approach will be Basil. Meatball will need a further two minutes and considerable eye contact.',
    image: { url: '/media/experiences/alpacas.jpg', alt: 'A child feeding an alpaca from a flat palm' },
    order: 0,
  },
  {
    slug: 'goat-mornings',
    title: 'Goat mornings',
    category: 'kids',
    season: 'Year-round',
    duration: 'Around 7am',
    shortDescription: 'They start shouting at seven. Bring the children and the grain scoop.',
    description:
      'Goat breakfast is the loudest and best fifteen minutes of the day. The herd comes to the gate complaining, gets fed, and immediately becomes delightful. Children who are shy around the larger animals almost always start here.',
    image: { url: '/media/experiences/goats.jpg', alt: 'Goats crowding the paddock gate at breakfast' },
    order: 1,
  },
  {
    slug: 'collect-the-eggs',
    title: 'Collect the eggs',
    category: 'kids',
    season: 'Year-round',
    duration: '10 minutes',
    shortDescription: 'Warm, blue-green, and yours. The basket is by the coop door.',
    description:
      'The nest boxes are along the back wall of the coop and there are usually a dozen waiting by mid-morning. Reach in slowly. If a hen is sitting, she will grumble and shuffle but she will not mind. Take what you find up to the kitchen.',
    image: { url: '/media/experiences/eggs.jpg', alt: 'A basket of freshly collected eggs' },
    order: 2,
  },
  {
    slug: 'garden-harvest',
    title: 'Garden harvest',
    category: 'garden',
    season: 'Best May through October',
    duration: 'As long as you like',
    shortDescription: 'Cut what you need for dinner. Scissors hang by the gate.',
    description:
      'The kitchen garden is yours to pick from. In summer: tomatoes, beans, chard, basil, zucchini in quantities that border on aggressive. In cooler months: greens, herbs, citrus from the trees at the end of the row. Take what you will actually cook and leave the rest to keep growing.',
    image: { url: '/media/experiences/garden.jpg', alt: 'Hands cutting herbs in the kitchen garden' },
    order: 3,
  },
  {
    slug: 'outdoor-movie-nights',
    title: 'Outdoor movie nights',
    category: 'gathering',
    season: 'Warm months',
    duration: 'After dark',
    shortDescription: 'A sheet on the barn wall, a projector, and every blanket in the house.',
    description:
      'The projector and screen live in the barn cupboard, and the barn wall does the rest. Sound carries beautifully out there. Children fall asleep in the second act, which is generally the point.',
    image: { url: '/media/experiences/movie-night.jpg', alt: 'A film projected onto the barn wall at dusk' },
    order: 4,
  },
  {
    slug: 'farm-breakfasts',
    title: 'Farm breakfasts',
    category: 'gathering',
    season: 'Year-round',
    duration: 'Slowly',
    shortDescription: 'Eggs from the coop, herbs from the bed outside the door.',
    description:
      'There is no restaurant here and no set breakfast time, which we think is the luxury. The eggs are twenty steps from the pan and the herbs are ten. Coffee is in the pantry. Take it out to the porch and do not hurry.',
    image: { url: '/media/experiences/breakfast.jpg', alt: 'Breakfast on the porch in morning light' },
    order: 5,
  },
  {
    slug: 'the-pizza-oven',
    title: 'The pizza oven',
    category: 'gathering',
    season: 'Year-round',
    duration: 'Light it two hours before',
    shortDescription: 'Wood-fired, temperamental, worth it.',
    description:
      'The oven takes about two hours to come up to heat, so light it before you think you need to. Dough recipe is taped inside the cupboard door. The first pizza is always a sacrifice to the fire gods. The second one is the best thing you will eat all week.',
    image: { url: '/media/experiences/pizza-oven.jpg', alt: 'The wood-fired pizza oven, lit at dusk' },
    order: 6,
  },
  {
    slug: 'the-fire-pit',
    title: 'The fire pit',
    category: 'gathering',
    season: 'Year-round',
    duration: 'Until someone gives in',
    shortDescription: 'Dry oak, a ring of chairs, and no reason to go inside.',
    description:
      'The wood store is stacked behind the barn and it is properly dry. The chairs are already in a ring. Bring marshmallows — the shop in Santa Ynez has them — and be prepared for the evening to last considerably longer than planned.',
    image: { url: '/media/experiences/fire-pit.jpg', alt: 'Chairs circled around the fire pit after dark' },
    order: 7,
  },
  {
    slug: 'stargazing',
    title: 'Stargazing',
    category: 'quiet',
    season: 'Year-round, best in winter',
    duration: 'One hour, minimum',
    shortDescription: 'No town light for miles. Lie on the lawn and let your eyes adjust.',
    description:
      'It takes about twenty minutes in full dark before you see what is actually up there, so resist checking your phone. The Milky Way is plainly visible most clear nights from June onward. There are blankets in the porch chest.',
    image: { url: '/media/experiences/stargazing.jpg', alt: 'The night sky above the oaks' },
    order: 8,
  },
  {
    slug: 'kids-adventures',
    title: 'Kids adventures',
    category: 'kids',
    season: 'Year-round',
    duration: 'All day, ideally',
    shortDescription: 'A creek, a rope swing, a treehouse, and no supervision required.',
    description:
      'The lower field has a seasonal creek, a rope swing on the big sycamore, and a treehouse built badly and lovingly. There is also a bucket of tools in the barn and a growing pile of scrap wood, which has produced some remarkable structures over the years. Let them go. They come back at dinner.',
    image: { url: '/media/experiences/kids.jpg', alt: 'Children running through the lower field' },
    order: 9,
  },
  {
    slug: 'seasonal-workshops',
    title: 'Seasonal workshops',
    category: 'seasonal',
    season: 'Spring and autumn',
    duration: 'A morning',
    shortDescription: 'Wreath-making, olive pressing, seed saving — whatever the season is doing.',
    description:
      'Depending on when you come, there may be something happening: pressing olives in November, making wreaths in December, saving seed in September, shearing the alpacas in spring. These are not scheduled events so much as things that need doing, which you are welcome to join. Ask when you arrive.',
    image: { url: '/media/experiences/workshops.jpg', alt: 'Hands making a wreath at the long table' },
    order: 10,
  },
];

export const contentPages = [
  {
    slug: 'stay',
    title: 'Stay',
    subtitle: 'Two homes, one piece of land, and no front desk.',
    seo: {
      title: 'Stay — The Little Blooming Farm',
      description:
        'Vicky sleeps eight. The Barn sleeps six. Both open onto the same garden, orchard and animals.',
    },
    heroImage: '/media/stay/hero.jpg',
    sections: [
      {
        type: 'richText',
        order: 0,
        content: {
          heading: 'Two homes',
          body: `There are two places to stay here and they share everything outside their own walls — the orchard, the garden, the pool, the fire pit, the animals, the quiet.

Take Vicky if you are a family or two, or a group who want to eat together every night. Take The Barn if you are two people who want a door of your own and very little else. Take both if you are all coming and someone needs their own kettle.`,
        },
      },
      { type: 'spacer', order: 1, content: { size: 'lg' } },
      {
        type: 'imageText',
        order: 2,
        content: {
          heading: 'Bedrooms',
          imagePosition: 'left',
          image: { url: '/media/stay/bedrooms.jpg', alt: 'A bedroom with linen curtains and morning light' },
          body: `Six beds across Vicky, three in The Barn. Linen sheets, wool blankets, blackout curtains in the rooms that need them.

The two upstairs rooms in Vicky are under the eaves and have the best light in the morning. The ground-floor rooms open directly onto the garden, which is the right choice if you are travelling with someone small who wakes early.`,
        },
      },
      {
        type: 'imageText',
        order: 3,
        content: {
          heading: 'The pool',
          imagePosition: 'right',
          image: { url: '/media/stay/pool.jpg', alt: 'Alpacas gathered at the fence' },
          body: `Heated from April to October, surrounded by lavender that hums audibly with bees on a hot afternoon.

It is not fenced. If you are bringing children who cannot swim, please tell us before you arrive and we will put up the temporary fence before you come.`,
        },
      },
      {
        type: 'imageText',
        order: 4,
        content: {
          heading: 'The spa',
          imagePosition: 'left',
          image: { url: '/media/stay/spa.jpg', alt: 'The spa at dusk, steam rising' },
          body: `Set slightly apart, facing away from the houses and toward the hills. It holds six comfortably.

The best time is about forty minutes after sunset in winter, when the sky is still going and it is cold enough to see the steam.`,
        },
      },
      {
        type: 'imageText',
        order: 5,
        content: {
          heading: 'Outdoor spaces',
          imagePosition: 'right',
          image: { url: '/media/stay/outdoor.jpg', alt: 'The long outdoor table under the string lights' },
          body: `The covered porch, the long outdoor table, the pizza oven, the fire pit, the lawn, the orchard, the lower field.

In practice, almost nobody spends much time indoors here between May and October. The house becomes somewhere you sleep and make coffee.`,
        },
      },
      {
        type: 'cta',
        order: 6,
        content: {
          heading: 'Ready when you are',
          body: 'Check the calendar for both homes and see what is open.',
          buttonLabel: 'See availability',
          buttonHref: '/book',
        },
      },
    ],
  },
  {
    slug: 'experiences',
    title: 'Experiences',
    subtitle: 'None of it is scheduled. All of it is there when you want it.',
    seo: {
      title: 'Experiences — The Little Blooming Farm',
      description:
        'Feed the alpacas, collect eggs, harvest the garden, light the pizza oven, watch a film on the barn wall.',
    },
    heroImage: '/media/experiences/hero.jpg',
    sections: [
      {
        type: 'richText',
        order: 0,
        content: {
          body: `There is no activities desk here and nothing to sign up for. What follows is a list of things that are simply available — the grain scoop is where we say it is, the fire wood is dry, the projector is in the barn cupboard.

Do all of it or none of it. The most common thing guests tell us afterwards is that they meant to do more and ended up sitting still instead, and that this turned out to be the point.`,
        },
      },
    ],
  },
  {
    slug: 'the-land',
    title: 'The Land',
    subtitle: 'Eleven acres in the Santa Ynez Valley, and what happened to them.',
    seo: {
      title: 'The Land — The Little Blooming Farm',
      description:
        'The history, the gardens, the animals, and what makes eleven acres in the Santa Ynez Valley feel the way this place feels.',
    },
    heroImage: '/media/land/hero.jpg',
    sections: [
      {
        type: 'richText',
        order: 0,
        content: {
          heading: 'Before it was ours',
          body: `The property was a working walnut orchard from the 1920s until sometime in the late seventies, when the trees stopped paying and the family who owned them stopped replanting. By the time we found it, about half the orchard had gone back to grass and the rest was old, gnarled, and still producing more walnuts than any household could use.

The original building — now The Barn — was the farm office. It has a concrete floor under the boards and a wall that is eighteen inches thick for no reason anyone has been able to explain.`,
        },
      },
      {
        type: 'fullBleedImage',
        order: 1,
        content: {
          image: { url: '/media/land/orchard.jpg', alt: 'The old walnut orchard in late afternoon light' },
          caption: 'The remaining walnut rows, planted around 1924.',
        },
      },
      {
        type: 'richText',
        order: 2,
        content: {
          heading: 'The gardens',
          body: `There are three, and they do different jobs.

The kitchen garden sits below The Barn in eight raised beds, and it is the one guests use. It is planted for continuous picking rather than for a single big harvest, which means there is almost always something worth cutting.

The cutting garden runs along the south fence — dahlias, zinnias, cosmos, sweet peas in spring. It exists purely so that there are flowers on the table, and you are welcome to cut them.

And then there is Erin's garden, which is its own thing, and has its own page.`,
        },
      },
      {
        type: 'quote',
        order: 3,
        content: {
          body: 'We did not set out to build a place people would cry at. That happened on its own, and we have stopped apologising for it.',
          attribution: 'From the guest book, second volume',
        },
      },
      {
        type: 'richText',
        order: 4,
        content: {
          heading: 'The animals',
          body: `They arrived in roughly this order: chickens, because everyone starts with chickens. Then the goats, which were supposed to clear brush and instead became pets. Then Cowboy. Then the alpacas, which were an entirely unplanned decision made at a livestock auction under conditions of poor judgement. Then the ducks, for the slugs. The peacocks invited themselves.

None of them are for show. They all do something, even if in the case of the alpacas what they do is mostly stand there being extraordinary.`,
        },
      },
      {
        type: 'imageText',
        order: 5,
        content: {
          heading: 'What makes it magical',
          imagePosition: 'left',
          image: { url: '/media/land/light.jpg', alt: 'Evening light through the oaks' },
          body: `Honestly, it is the light and the quiet, and the fact that there is nothing here to achieve.

The valley runs east to west, which is unusual, and it means the light comes down the length of it in the evening rather than across it. Everything goes gold for about forty minutes. People stop talking mid-sentence.

The other half of it is that there is no itinerary. Children work this out within about two hours and adults take until the second morning. Then something goes out of your shoulders and stays out.`,
        },
      },
    ],
  },
  {
    slug: 'garden-of-erin',
    title: 'The Garden of Erin',
    subtitle: 'Why this place exists.',
    seo: {
      title: 'The Garden of Erin — The Little Blooming Farm',
      description:
        'A garden planted for Erin, and the reason The Little Blooming Farm is here at all.',
    },
    heroImage: '/media/erin/hero.jpg',
    sections: [
      {
        type: 'richText',
        order: 0,
        content: {
          body: `Erin had an instinct for beauty that shaped this place in countless ways. She noticed the details most people passed over: the way a room felt, the balance of texture and light, the warmth of a material, the quiet difference between something that simply looked good and something that felt alive.

Her aesthetic was never about perfection. It was about creating spaces that felt soulful, natural, welcoming, and deeply considered. The Little Blooming Farm carries that sensibility throughout, in the choices, the atmosphere, and the feeling of being here.

The Garden of Erin is a continuation of that eye for beauty and the care she brought to the spaces around her.`,
        },
      },
      {
        type: 'fullBleedImage',
        order: 1,
        content: {
          image: { url: '/media/erin/garden.jpg', alt: "Erin's garden in full spring bloom" },
          caption: '',
        },
      },
      {
        type: 'richText',
        order: 2,
        content: {
          heading: 'The garden',
          body: `It is at the top of the rise, past the olive tree, where you can see the whole valley open up. It was the first thing planted after the house was liveable and it took three years to become what it is.

It is not a memorial garden in the way that phrase usually sounds. There is no plaque and nothing solemn about it. It is loud with bees. Things are always slightly overgrown because Erin thought tidy gardens were a failure of nerve. There are roses she chose from a catalogue in a hospital bed, and they have all done well.

Children run through it constantly. This is correct and we would like it to continue.`,
        },
      },
      {
        type: 'richText',
        order: 3,
        content: {
          heading: 'How guests keep it going',
          body: `The farm exists because of her, and it stays open because of you.

Every booking made directly through this site — rather than through a listing site that takes its cut — goes further toward keeping eleven acres, two houses, and a great many animals in good order. That is the whole of it. There is no fund to donate to and nothing to sign up for.

Come, stay, let your children get filthy, cut the flowers, and leave the gate as you found it. That is what keeps the legacy going. It turns out to be enough.`,
        },
      },
      {
        type: 'quote',
        order: 4,
        content: {
          body: 'Plant it anyway. You will not always be here to see it and that has never once been the point.',
          attribution: 'Erin',
        },
      },
    ],
  },
  {
    slug: 'local-guide',
    title: 'Local Guide',
    subtitle: 'What we would do, if we were you, and we had a week.',
    seo: {
      title: 'Local Guide — Santa Ynez, Solvang & the valley',
      description:
        'Wine tasting, beaches, hikes, restaurants, bike rides and horseback riding around the Santa Ynez Valley.',
    },
    heroImage: '/media/local/hero.jpg',
    sections: [
      {
        type: 'richText',
        order: 0,
        content: {
          body: `Everything below is within forty minutes of the front gate, and most of it is within fifteen. We have left out the places everyone already writes about unless they genuinely deserve it.`,
        },
      },
      {
        type: 'grid',
        order: 1,
        content: {
          heading: 'Wine',
          intro:
            'The valley is Pinot and Chardonnay in the cool west, Rhône varieties and Sauvignon Blanc as you come east toward us.',
          items: [
            {
              title: 'Los Olivos, on foot',
              body: 'Twenty tasting rooms in six walkable blocks. Park once and stay all afternoon. Go on a weekday if you can.',
              image: { url: '/media/local/los-olivos.jpg', alt: 'A tasting room in Los Olivos' },
            },
            {
              title: 'Ballard Canyon',
              body: 'Ten minutes from the gate, and the Syrah here is the valley at its most serious. Small producers, appointment only, worth the phone call.',
              image: { url: '/media/local/ballard.jpg', alt: 'Vineyard rows in Ballard Canyon' },
            },
            {
              title: 'Sta. Rita Hills',
              body: 'Thirty-five minutes west and noticeably colder. This is the Pinot Noir everyone comes to California for.',
              image: { url: '/media/local/sta-rita.jpg', alt: 'Fog rolling over the Sta. Rita Hills' },
            },
          ],
        },
      },
      {
        type: 'grid',
        order: 2,
        content: {
          heading: 'Solvang',
          intro:
            'Yes, it is a Danish theme town. Go early, eat the pastry, be charmed, leave before the coaches arrive.',
          items: [
            {
              title: 'The bakeries',
              body: 'Get there before nine. Aebleskiver for the children, cardamom for you.',
              image: { url: '/media/local/solvang-bakery.jpg', alt: 'Danish pastries in a Solvang bakery window' },
            },
            {
              title: 'Hans Christian Andersen Museum',
              body: 'Small, free, unexpectedly lovely, and about twenty-five minutes long — which is exactly right.',
              image: { url: '/media/local/solvang-museum.jpg', alt: 'A quiet museum room in Solvang' },
            },
            {
              title: 'Old Mission Santa Inés',
              body: 'Founded 1804. The garden at the back is the quietest place in town and almost nobody walks around to it.',
              image: { url: '/media/local/mission.jpg', alt: 'The bell tower of Old Mission Santa Inés' },
            },
          ],
        },
      },
      {
        type: 'grid',
        order: 3,
        content: {
          heading: 'Beaches',
          intro: 'Forty minutes over the pass and the whole climate changes.',
          items: [
            {
              title: 'Refugio State Beach',
              body: 'Palm trees, calm water, easy parking. The best one for small children by a wide margin.',
              image: { url: '/media/local/refugio.jpg', alt: 'Palms along the sand at Refugio' },
            },
            {
              title: 'Jalama Beach',
              body: 'Wild, windy, and an hour of genuinely beautiful driving to get there. Get the burger at the store. Everyone does.',
              image: { url: '/media/local/jalama.jpg', alt: 'The wide empty sand at Jalama Beach' },
            },
            {
              title: 'Gaviota',
              body: 'Under the train trestle, with a fishing pier and far fewer people than it deserves.',
              image: { url: '/media/local/gaviota.jpg', alt: 'The trestle bridge above Gaviota beach' },
            },
          ],
        },
      },
      {
        type: 'grid',
        order: 4,
        content: {
          heading: 'Hikes & rides',
          intro: 'Go early. By eleven in summer the valley floor is genuinely hot.',
          items: [
            {
              title: 'Nojoqui Falls',
              body: 'Ten easy minutes to a hundred-foot waterfall. Best after rain, and perfect for short legs.',
              image: { url: '/media/local/nojoqui.jpg', alt: 'Nojoqui Falls through the trees' },
            },
            {
              title: 'Figueroa Mountain',
              body: 'Drive up, walk the ridge. In a good March the wildflowers are absurd and people come from three counties away.',
              image: { url: '/media/local/figueroa.jpg', alt: 'Wildflowers on Figueroa Mountain' },
            },
            {
              title: 'Horseback riding',
              body: 'Several stables in the valley run valley-floor and ridge rides. Ask us and we will call whoever has the gentlest horses that month.',
              image: { url: '/media/local/riding.jpg', alt: 'Horses on a valley trail' },
            },
            {
              title: 'The Santa Ynez loop, by bike',
              body: 'Roughly 22 flat miles through Santa Ynez, Los Olivos and Ballard on quiet roads. Bikes are in the barn.',
              image: { url: '/media/local/cycling.jpg', alt: 'A quiet valley road lined with oaks' },
            },
          ],
        },
      },
      {
        type: 'grid',
        order: 5,
        content: {
          heading: 'Eating',
          intro: 'Book ahead for dinner anywhere in the valley on a Friday or Saturday. Genuinely.',
          items: [
            {
              title: 'Los Olivos, for dinner',
              body: 'The best cooking in the valley is in a three-block radius here. Ask us for the current favourite — it moves around.',
              image: { url: '/media/local/dinner.jpg', alt: 'A table set for dinner in Los Olivos' },
            },
            {
              title: 'Santa Ynez town',
              body: 'Two minutes from us. A proper old saloon, a very good butcher, and the grocery store you will actually be using.',
              image: { url: '/media/local/santa-ynez.jpg', alt: 'Main street in Santa Ynez' },
            },
            {
              title: "Saturday farmers' markets",
              body: 'Solvang on Saturday morning. Everything you need for a week of cooking, plus the olive oil we use here.',
              image: { url: '/media/local/market.jpg', alt: "Produce at the farmers' market" },
            },
          ],
        },
      },
    ],
  },
];

/** Placeholder gallery entries — replace these from /admin once photos exist. */
export const gallery = [
  { url: '/media/gallery/01.jpg', alt: 'The orchard in evening light', order: 0 },
  { url: '/media/gallery/02.jpg', alt: 'The long table set for dinner outdoors', order: 1 },
  { url: '/media/gallery/03.jpg', alt: 'A child feeding the alpacas', order: 2 },
  { url: '/media/gallery/04.jpg', alt: 'Alpacas gathered at the fence', order: 3 },
  { url: '/media/gallery/05.jpg', alt: 'Hens in the orchard grass', order: 4 },
  { url: '/media/gallery/06.jpg', alt: 'The kitchen garden in high summer', order: 5 },
  { url: '/media/gallery/07.jpg', alt: 'The fire pit after dark', order: 6 },
  { url: '/media/gallery/08.jpg', alt: 'Children playing under the old oak', order: 7 },
  { url: '/media/gallery/09.jpg', alt: 'The peacock displaying beneath the oaks', order: 8 },
  { url: '/media/gallery/10.jpg', alt: "Erin's garden in spring", order: 9 },
  { url: '/media/gallery/11.jpg', alt: 'The clawfoot bath by the window', order: 10 },
  { url: '/media/gallery/12.jpg', alt: 'The valley at golden hour from the top of the rise', order: 11 },
];
