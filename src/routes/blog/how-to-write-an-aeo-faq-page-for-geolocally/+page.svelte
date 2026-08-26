<script>
	import BlogPostLayout from '$lib/components/marketing/BlogPostLayout.svelte';
	import { blogPostBySlug } from '$lib/content/blog-posts';

	const post = blogPostBySlug['how-to-write-an-aeo-faq-page-for-geolocally'];
</script>

<BlogPostLayout {post}>
	{@html post.bodyHtml}
</BlogPostLayout>
