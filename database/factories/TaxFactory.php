<?php

namespace Database\Factories;

use Ds\Models\Tax;
use Illuminate\Database\Eloquent\Factories\Factory;

class TaxFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = Tax::class;

    /**
     * Define the model's default state.
     *
     * @return array
     */
    public function definition()
    {
        return [
            'code' => $this->faker->regexify('[A-Z]{2,3}') . ' Tax',
            'description' => $this->faker->words(mt_rand(3, 6), true),
            'rate' => mt_rand(1, 30 * 100) / 100,
        ];
    }
}
