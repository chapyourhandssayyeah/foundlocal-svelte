<script>
	import SectionLabel from '$lib/components/ui/SectionLabel.svelte';

	// Free AEO Audit landing page.
	// Goal: convert cold visitors into a real conversation with a concrete, low-commitment ask.
	// Deliverable: a 1-page report on whether the business is named by the major AI assistants
	// for queries like "best [service] in [city]" — sent within 3 business days, no charge.

	// Structured lead form → FormSubmit AJAX endpoint, delivering to hello@geolocally.com.
	// mailto: stays as the fallback if the fetch fails.
	const FORM_ENDPOINT = 'https://formsubmit.co/ajax/hello@geolocally.com';

	let businessName = $state('');
	let service = $state('');
	let city = $state('');
	let website = $state('');
	let phone = $state('');
	let email = $state('');
	let submitting = $state(false);
	let submitted = $state(false);
	let error = $state('');

	function buildMailto() {
		const subject = encodeURIComponent(`Free AI search audit request — ${businessName || '(business name)'}`);
		const body = encodeURIComponent(
			`Hey GeoLocally,\n\nI'd like the free AI search audit.\n\n` +
			`Business name: ${businessName}\n` +
			`Service: ${service}\n` +
			`City: ${city}\n` +
			`Website: ${website || '(none)'}\n` +
			`Phone: ${phone}\n` +
			`Reply to: ${email}\n\n` +
			`Thanks.`
		);
		return `mailto:hello@geolocally.com?subject=${subject}&body=${body}`;
	}

	async function handleSubmit(e) {
		e.preventDefault();
		submitting = true;
		error = '';
		try {
			const res = await fetch(FORM_ENDPOINT, {
				method: 'POST',
				headers: { 'content-type': 'application/json', accept: 'application/json' },
				body: JSON.stringify({
					_subject: `Audit request — ${businessName}`,
					businessName, service, city, website, phone, email, source: 'audit-page'
				})
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			submitted = true;
		} catch (err) {
			// Fallback: open user's mail client with prefilled body.
			window.location.href = buildMailto();
			submitted = true;
		} finally {
			submitting = false;
		}
	}

	// Legacy mailto for the two button locations that don't use the form
	const quickMailto = 'mailto:hello@geolocally.com?subject=Free%20AI%20search%20audit%20request';
</script>

<svelte:head>
	<title>Free AI Search Audit — find out if ChatGPT and Google AI name your business | GeoLocally</title>
	<meta
		name="description"
		content="We check whether ChatGPT, Perplexity, Google AI Overview, Gemini, and Copilot name your business when customers ask for the best [your service] in [your city]. 1-page report, 3 business days, free."
	/>
	<link rel="canonical" href="https://geolocally.com/audit" />
	<meta property="og:title" content="Free AI Search Audit | GeoLocally" />
	<meta
		property="og:description"
		content="Find out if ChatGPT, Perplexity, and Google AI Overview name your business when customers ask. 1-page report, 3 business days, free."
	/>
	<meta property="og:url" content="https://geolocally.com/audit" />
</svelte:head>

<!-- HERO -->
<section class="bg-gray-900 text-white">
	<div class="container mx-auto max-w-4xl px-4 py-20 md:py-24 text-center">
		<SectionLabel>Free for the first 25 businesses</SectionLabel>
		<h1
			class="font-display text-4xl md:text-6xl font-black italic leading-tight text-balance mb-6 mt-4"
		>
			Find out if AI search names your business.
		</h1>
		<p class="text-lg md:text-xl text-gray-300 leading-relaxed max-w-2xl mx-auto mb-8">
			We open ChatGPT, Perplexity, Google AI Overview, Gemini, and Copilot. We ask each one for the
			best [your service] in [your city]. We screenshot the answer. We send you a 1-page report on
			where you stand and the top 3 things to fix.
		</p>
		<p class="text-base text-gray-400 mb-8">
			Takes us a few hours. Free for you. 3 business days from request to report.
		</p>
		<a
			href="#audit-form"
			class="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-lg font-bold text-gray-900 transition-colors hover:bg-gray-100"
		>
			Request your free audit
		</a>
		<p class="mt-4 text-sm text-gray-400">
			30 seconds to fill in. We'll reply within 1 business day.
		</p>
	</div>
</section>

<!-- WHAT'S IN THE REPORT -->
<section class="bg-[#030712] text-white py-16 md:py-20">
	<div class="container mx-auto max-w-3xl px-4">
		<h2 class="font-display text-3xl md:text-4xl font-black italic text-white mb-10 text-center">
			What you actually get
		</h2>
		<div class="space-y-8">
			<div>
				<h3 class="text-xl font-bold text-white mb-2">1. The screenshots</h3>
				<p class="text-gray-300 leading-relaxed">
					Five AI assistants, one query each in the format real customers use ("best [your
					service] near me in [your city]"). You see exactly what comes back. Including which
					businesses get named instead of you, if any.
				</p>
			</div>
			<div>
				<h3 class="text-xl font-bold text-white mb-2">2. The verdict</h3>
				<p class="text-gray-300 leading-relaxed">
					A one-line read on whether you're mentioned, mentioned but vaguely, or missing
					entirely. Honest answer, not a sales pitch — sometimes the verdict is "you're already
					showing up well, don't change anything."
				</p>
			</div>
			<div>
				<h3 class="text-xl font-bold text-white mb-2">3. The top 3 fixes</h3>
				<p class="text-gray-300 leading-relaxed">
					If you're not showing up, three specific things on your website or Google Business
					Profile that are getting in the way — in order of how much they matter. Concrete enough
					that you could hand them to whoever runs your site and they'd know what to do.
				</p>
			</div>
			<div>
				<h3 class="text-xl font-bold text-white mb-2">4. What competitors are doing</h3>
				<p class="text-gray-300 leading-relaxed">
					If a competitor is getting named instead of you, we tell you what they're doing
					differently. Sometimes it's just a clearer first paragraph on their homepage. Sometimes
					it's a video. We'll show you.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- WHO IT'S FOR -->
<section class="bg-slate-900 text-white py-16 md:py-20">
	<div class="container mx-auto max-w-3xl px-4">
		<h2 class="font-display text-3xl md:text-4xl font-black italic text-white mb-6 text-center">
			Who this is for
		</h2>
		<p class="text-lg text-gray-300 leading-relaxed text-center mb-10 max-w-2xl mx-auto">
			Local service businesses where customers used to find you on Google and increasingly find you
			(or don't) via ChatGPT, Perplexity, Siri, Alexa, and Google's AI Overview.
		</p>
		<div class="grid md:grid-cols-2 gap-6">
			<div class="border border-slate-700 rounded-lg bg-slate-800 p-6">
				<h3 class="text-lg font-bold text-white mb-2">Built for</h3>
				<ul class="text-gray-300 space-y-2 leading-relaxed">
					<li>• Plumbers, HVAC, electricians, roofers</li>
					<li>• Dentists, med spas, chiropractors</li>
					<li>• Lawyers, accountants, financial advisors</li>
					<li>• Any local service with a phone number and a service area</li>
				</ul>
			</div>
			<div class="border border-slate-700 rounded-lg bg-slate-800 p-6">
				<h3 class="text-lg font-bold text-white mb-2">Not a fit if</h3>
				<ul class="text-gray-300 space-y-2 leading-relaxed">
					<li>• You sell online to a national audience (AEO works differently)</li>
					<li>• You're a brand with hundreds of locations (you need an enterprise tool)</li>
					<li>• You've never owned the website you're asking us to audit</li>
				</ul>
			</div>
		</div>
	</div>
</section>

<!-- WHAT HAPPENS NEXT -->
<section class="bg-[#030712] text-white py-16 md:py-20">
	<div class="container mx-auto max-w-3xl px-4">
		<h2 class="font-display text-3xl md:text-4xl font-black italic text-white mb-10 text-center">
			What happens next
		</h2>
		<ol class="space-y-6 text-lg text-gray-300 leading-relaxed">
			<li>
				<strong class="text-white">1. You email us.</strong> Business name, service, city,
				website (if any), phone. Two sentences is fine.
			</li>
			<li>
				<strong class="text-white">2. We run the checks.</strong> 3 business days. We don't
				outsource it; it's done by hand because the AI answers change daily and we want to see
				what your prospects actually see today.
			</li>
			<li>
				<strong class="text-white">3. You get the report.</strong> 1 page. PDF in your inbox. Read
				it in 5 minutes.
			</li>
			<li>
				<strong class="text-white">4. If you want help fixing it</strong>, that's our $499
				storefront — one focused landing page + 30-second video built for AI search, live in 5
				business days. Optional. The audit stands on its own and you owe us nothing.
			</li>
		</ol>
	</div>
</section>

<!-- BOTTOM CTA — the actual audit request form -->
<section id="audit-form" class="bg-gray-900 text-white py-16 md:py-20">
	<div class="container mx-auto max-w-2xl px-4">
		<h2 class="font-display text-3xl md:text-4xl font-black italic text-white mb-4 text-center">
			Ready when you are.
		</h2>
		<p class="text-base text-gray-300 leading-relaxed mb-10 max-w-xl mx-auto text-center">
			Six quick fields. We reply within 1 business day. Report lands in 3 business days.
		</p>

		{#if submitted}
			<div class="rounded-xl bg-emerald-900/40 border border-emerald-600 p-6 text-center">
				<p class="text-lg font-bold text-white mb-2">Thanks — we got it.</p>
				<p class="text-gray-300">
					You'll hear from us at <strong>{email || 'the email you provided'}</strong> within 1 business
					day. If the report is going to take longer than 3 business days, we'll tell you why.
				</p>
			</div>
		{:else}
			<form onsubmit={handleSubmit} class="space-y-5">
				<div>
					<label for="business-name" class="block text-sm font-medium text-gray-200 mb-1">Business name</label>
					<input
						id="business-name"
						type="text"
						required
						bind:value={businessName}
						placeholder="e.g. Bay Area Plumbers"
						class="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
					/>
				</div>
				<div class="grid md:grid-cols-2 gap-5">
					<div>
						<label for="service" class="block text-sm font-medium text-gray-200 mb-1">Service</label>
						<input
							id="service"
							type="text"
							required
							bind:value={service}
							placeholder="Plumbing, dental, HVAC, law…"
							class="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
						/>
					</div>
					<div>
						<label for="city" class="block text-sm font-medium text-gray-200 mb-1">City</label>
						<input
							id="city"
							type="text"
							required
							bind:value={city}
							placeholder="Tampa, Miami, Orlando…"
							class="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
						/>
					</div>
				</div>
				<div>
					<label for="website" class="block text-sm font-medium text-gray-200 mb-1">Website (if any)</label>
					<input
						id="website"
						type="url"
						bind:value={website}
						placeholder="https://yourbusiness.com"
						class="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
					/>
				</div>
				<div class="grid md:grid-cols-2 gap-5">
					<div>
						<label for="phone" class="block text-sm font-medium text-gray-200 mb-1">Phone</label>
						<input
							id="phone"
							type="tel"
							bind:value={phone}
							placeholder="(813) 555-1234"
							class="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
						/>
					</div>
					<div>
						<label for="email" class="block text-sm font-medium text-gray-200 mb-1">Your email</label>
						<input
							id="email"
							type="email"
							required
							bind:value={email}
							placeholder="you@yourbusiness.com"
							class="w-full rounded-lg bg-gray-800 border border-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
						/>
					</div>
				</div>
				<button
					type="submit"
					disabled={submitting}
					class="w-full inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-lg font-bold text-gray-900 transition-colors hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{submitting ? 'Sending…' : 'Send my free audit request →'}
				</button>
				{#if error}
					<p class="text-red-400 text-sm text-center">{error}</p>
				{/if}
				<p class="text-xs text-gray-400 text-center">
					Or email <a href={quickMailto} class="underline">hello@geolocally.com</a> directly.
				</p>
			</form>
		{/if}
	</div>
</section>
