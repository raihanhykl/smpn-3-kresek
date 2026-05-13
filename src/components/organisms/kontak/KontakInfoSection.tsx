import { Container } from '@components/atoms/Container';
import { SectionHeading } from '@components/atoms/SectionHeading';
import { ContactCard } from '@components/molecules/ContactCard';
import { SocialCard } from '@components/molecules/SocialCard';
import type { ContactPageConfig, SocialLink } from '@config/types';

export function KontakInfoSection({
  data,
  social,
}: {
  data: ContactPageConfig['kontakInfo'];
  social: SocialLink[];
}) {
  return (
    <section className="bg-white py-24">
      <Container>
        <SectionHeading eyebrow={data.meta.eyebrow} title={data.meta.title} subtitle={data.meta.subtitle} />
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            {data.cards.map((c, i) => (
              <ContactCard key={i} data={c} />
            ))}
          </div>
          <div>
            <h3 className="font-heading text-xl font-bold text-neutral-900">{data.socialHeading}</h3>
            <p className="mt-2 text-sm text-neutral-600">{data.socialSub}</p>
            <div className="mt-5 space-y-3">
              {social.map((s) => (
                <SocialCard key={s.platform} data={s} />
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
