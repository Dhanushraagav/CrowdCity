

async function testAutoCategorization() {
  const examples = [
    {
      title: "Broken Footpath near park",
      description: "The sidewalk is cracked and pavement is rising, causing a major tripping hazard."
    },
    {
      title: "Streetlight Not Working",
      description: "The streetlamp near the crossing is completely dark and needs bulb replacement."
    },
    {
      title: "Water Leakage from pipe",
      description: "Clean water is gushing out from the main pipeline supply on the street."
    },
    {
      title: "Blocked Drain after rain",
      description: "The street gutter is clogged with leaves and plastic bags, causing water to pool."
    },
    {
      title: "Overflowing Garbage Bin",
      description: "Huge pile of trash bags dumped on the sidewalk and bin is full."
    },
    {
      title: "Traffic Signal Failure at Main intersection",
      description: "Traffic lights are flashing red, causing massive gridlock."
    },
    {
      title: "Broken Bus Stop Bench",
      description: "The public seating bench at the transit shelter is damaged and unusable."
    },
    {
      title: "Park Equipment Damage",
      description: "Children's playground swing set has a snapped chain and is unsafe."
    },
    {
      title: "Dirty Public Toilet",
      description: "The civic restroom in the square is blocked and unclean."
    },
    {
      title: "Open Manhole on street",
      description: "A deep manhole is uncovered without any warning sign, posing extreme danger."
    },
    {
      title: "Mosquito Breeding Area",
      description: "Stagnant drainage pool is breeding swarm of mosquitoes near the housing area."
    },
    {
      title: "Alien spacecraft landed",
      description: "Unidentified object has blocked the lane, unknown reason."
    }
  ];

  console.log("Starting Auto-Categorization Tests...\n");

  for (const ex of examples) {
    try {
      const res = await fetch('https://crowdcity-api.onrender.com/api/ai/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-jwt-token-citizen'
        },
        body: JSON.stringify(ex)
      });
      const data = await res.json();
      console.log(`Title: "${ex.title}"`);
      console.log("Response:", data);
      console.log();
    } catch (err) {
      console.error(`Error testing: ${ex.title}:`, err.message);
    }
  }
}

testAutoCategorization();
