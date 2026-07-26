export default function Testimonials() {
  const notes = [
    {
      name: 'Ramesh Patil',
      role: 'Farmer, Solapur',
      quote: 'Pehle dalal 40% kaat lete the. Ab seedha buyer se baat hoti hai, aur paisa poora milta hai.',
    },
    {
      name: 'Anjali Deshmukh',
      role: 'Home cook, Pune',
      quote: 'The tomatoes taste like they did at my grandmother\u2019s farm. And I know exactly whose farm it is.',
    },
    {
      name: 'Vitthal Jadhav',
      role: 'Farmer, Akkalkot',
      quote: 'Price prediction feature ne mujhe sahi time pe bechne mein madad ki. Ab loss nahi hota.',
    },
  ];

  return (
    <div className="bg-[#EEF2E7] py-16">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="font-serif text-3xl text-[#241F1A] mb-10">From the field and the kitchen</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {notes.map((t) => (
            <div
              key={t.name}
              className="bg-[#FAF6ED] p-6 rounded-sm shadow-sm border-t-4 border-[#E8A33D]"
            >
              <p className="text-[#241F1A]/80 text-sm leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
              <div className="text-sm font-semibold text-[#241F1A]">{t.name}</div>
              <div className="text-xs text-[#241F1A]/60">{t.role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}